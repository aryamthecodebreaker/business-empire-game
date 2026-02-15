// Supabase API client — auth, leaderboard, city sync, chat, challenges

let supabaseClient = null;

const api = {
    async init() {
        if (SUPABASE_URL === 'YOUR_SUPABASE_URL') {
            console.log('Supabase not configured — running in offline mode');
            return false;
        }

        try {
            supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

            const { data: { session } } = await supabaseClient.auth.getSession();

            if (!session) {
                const deviceId = localStorage.getItem('deviceId') || crypto.randomUUID();
                localStorage.setItem('deviceId', deviceId);

                const { data, error } = await supabaseClient.auth.signInAnonymously();
                if (error) throw error;
            }

            const user = (await supabaseClient.auth.getUser()).data.user;
            if (user) {
                await api.ensurePlayerRecord(user.id);
            }

            return true;
        } catch (err) {
            console.error('Supabase init failed:', err);
            return false;
        }
    },

    async ensurePlayerRecord(authId) {
        const { data: existing } = await supabaseClient
            .from('players')
            .select('id, display_name')
            .eq('supabase_auth_id', authId)
            .single();

        if (existing) {
            mpState.playerId = existing.id;
            mpState.playerName = existing.display_name;
            await api.restoreCitySession(existing.id);
            return existing;
        }

        const displayName = game.businessName || 'Player_' + Math.floor(Math.random() * 9999);
        const { data: newPlayer, error } = await supabaseClient
            .from('players')
            .insert({
                supabase_auth_id: authId,
                display_name: displayName
            })
            .select()
            .single();

        if (error) throw error;
        mpState.playerId = newPlayer.id;
        mpState.playerName = newPlayer.display_name;
        return newPlayer;
    },

    async restoreCitySession(playerId) {
        try {
            const { data } = await supabaseClient
                .from('city_members')
                .select('city_id, cities(id, name, weather, economic_health, avg_price, total_businesses, join_code)')
                .eq('player_id', playerId)
                .eq('is_active', true)
                .single();

            if (data && data.cities) {
                const city = data.cities;
                mpState.cityId = city.id;
                mpState.cityName = city.name;
                mpState.cityWeather = city.weather;
                mpState.cityEconomyHealth = city.economic_health || 1.0;
                mpState.cityAvgPrice = city.avg_price || 1.0;
                mpState.cityPlayerCount = city.total_businesses || 1;
                mpState.cityJoinCode = city.join_code || null;
                mpState.mode = 'city';
            }
        } catch (err) {
            // Not in a city — stay in solo mode
        }
    },

    async updateDisplayName(name) {
        if (!supabaseClient || !mpState.playerId) return;
        await supabaseClient
            .from('players')
            .update({ display_name: name })
            .eq('id', mpState.playerId);
        mpState.playerName = name;
    },

    async submitDayResult(dayResult) {
        if (!supabaseClient || !mpState.playerId) return null;

        try {
            await supabaseClient.from('day_results').insert({
                player_id: mpState.playerId,
                city_id: mpState.cityId || null,
                day_number: dayResult.day,
                price_set: dayResult.price,
                customers_served: dayResult.customers,
                revenue: dayResult.revenue,
                profit: dayResult.profit,
                weather: dayResult.weather,
                catastrophe: dayResult.catastrophe
            });

            await supabaseClient.from('players').update({
                last_active: new Date().toISOString(),
                total_days_played: game.day,
                best_revenue: Math.max(game.totalRevenue, 0),
                best_cash: Math.max(game.cash, 0),
                best_day_customers: Math.max(game.bestDay, 0)
            }).eq('id', mpState.playerId);

            const entries = [
                { type: 'daily', metric: 'revenue', score: dayResult.revenue },
                { type: 'alltime', metric: 'revenue', score: game.totalRevenue },
                { type: 'alltime', metric: 'customers', score: game.totalCustomers }
            ];

            for (const entry of entries) {
                await supabaseClient.from('leaderboard_entries').upsert({
                    player_id: mpState.playerId,
                    player_name: mpState.playerName,
                    leaderboard_type: entry.type,
                    metric: entry.metric,
                    score: entry.score,
                    period_start: entry.type === 'daily' ? new Date().toISOString().split('T')[0] : null,
                    city_id: mpState.cityId || null
                }, {
                    onConflict: 'player_id,leaderboard_type,metric'
                });
            }

            const { data: rankData } = await supabaseClient
                .from('leaderboard_entries')
                .select('score')
                .eq('leaderboard_type', 'alltime')
                .eq('metric', 'revenue')
                .gt('score', game.totalRevenue)
                .order('score', { ascending: false });

            const rank = (rankData ? rankData.length : 0) + 1;
            return { rank: rank };
        } catch (err) {
            console.warn('Failed to submit day result:', err);
            return null;
        }
    },

    async fetchLeaderboard(type, metric, limit) {
        if (!supabaseClient) return [];
        limit = limit || 50;

        try {
            let query = supabaseClient
                .from('leaderboard_entries')
                .select('player_name, score, player_id')
                .eq('leaderboard_type', type)
                .eq('metric', metric)
                .order('score', { ascending: false })
                .limit(limit);

            if (type === 'daily') {
                query = query.eq('period_start', new Date().toISOString().split('T')[0]);
            }

            if (type === 'city' && mpState.cityId) {
                query = query.eq('city_id', mpState.cityId);
            }

            const { data, error } = await query;
            if (error) throw error;

            return (data || []).map(function(entry, i) {
                return {
                    rank: i + 1,
                    playerName: entry.player_name,
                    score: entry.score,
                    isYou: entry.player_id === mpState.playerId
                };
            });
        } catch (err) {
            console.warn('Leaderboard fetch failed:', err);
            return [];
        }
    },

    async syncGameState(gameState) {
        if (!supabaseClient || !mpState.playerId) return;

        try {
            await supabaseClient.from('game_saves').upsert({
                player_id: mpState.playerId,
                city_id: mpState.cityId || null,
                game_state: gameState,
                day: gameState.day,
                cash: gameState.cash,
                total_revenue: gameState.totalRevenue,
                reputation: gameState.reputation,
                level: gameState.level,
                is_active: true
            }, {
                onConflict: 'player_id'
            });
        } catch (err) {
            console.warn('Game state sync failed:', err);
        }
    },

    async joinCity() {
        if (!supabaseClient || !mpState.playerId) return null;

        try {
            const { data: cities } = await supabaseClient
                .from('cities')
                .select('id, name, weather, current_day, max_players, total_businesses, economic_health, avg_price, customer_pool')
                .lt('total_businesses', CITY_CONFIG.MAX_PLAYERS)
                .gte('total_businesses', 0)
                .order('total_businesses', { ascending: false })
                .limit(1);

            let city;
            if (cities && cities.length > 0) {
                city = cities[0];
            } else {
                const cityNames = [
                    'Riverside Market', 'Downtown District', 'Sunset Boulevard',
                    'Harbor Square', 'Green Valley', 'Central Plaza',
                    'Maple Street', 'Oceanview', 'Mountain Ridge', 'Lakeside'
                ];
                const name = cityNames[Math.floor(Math.random() * cityNames.length)] + ' #' + Math.floor(Math.random() * 999);

                const { data: newCity, error } = await supabaseClient
                    .from('cities')
                    .insert({
                        name: name,
                        weather: getRandomWeather(),
                        max_players: CITY_CONFIG.MAX_PLAYERS,
                        customer_pool: CITY_CONFIG.BASE_CUSTOMER_POOL,
                        economic_health: 1.0,
                        join_code: Math.random().toString(36).substring(2, 8).toUpperCase()
                    })
                    .select()
                    .single();

                if (error) throw error;
                city = newCity;
            }

            await supabaseClient.from('city_members').upsert({
                city_id: city.id,
                player_id: mpState.playerId,
                is_active: true
            });

            await supabaseClient.from('cities').update({
                total_businesses: (city.total_businesses || 0) + 1
            }).eq('id', city.id);

            mpState.cityId = city.id;
            mpState.cityName = city.name;
            mpState.cityWeather = city.weather;
            mpState.cityEconomyHealth = city.economic_health || 1.0;
            mpState.cityAvgPrice = city.avg_price || 1.0;
            mpState.cityPlayerCount = (city.total_businesses || 0) + 1;
            mpState.cityJoinCode = city.join_code || null;
            mpState.mode = 'city';

            return city;
        } catch (err) {
            console.error('Failed to join city:', err);
            return null;
        }
    },

    async createPrivateCity() {
        if (!supabaseClient || !mpState.playerId) return null;
        try {
            let cityData = null;
            for (let attempt = 0; attempt < 5; attempt++) {
                const join_code = Math.random().toString(36).substring(2, 8).toUpperCase();
                const cityName = (game.businessName || 'Player') + "'s City";
                const { data, error } = await supabaseClient
                    .from('cities')
                    .insert({
                        name: cityName,
                        weather: getRandomWeather(),
                        max_players: CITY_CONFIG.MAX_PLAYERS,
                        customer_pool: CITY_CONFIG.BASE_CUSTOMER_POOL,
                        economic_health: 1.0,
                        join_code: join_code
                    })
                    .select()
                    .single();
                if (!error && data) { cityData = data; break; }
            }
            if (!cityData) return null;

            await supabaseClient.from('city_members').upsert({
                city_id: cityData.id, player_id: mpState.playerId, is_active: true
            });
            await supabaseClient.from('cities').update({ total_businesses: 1 }).eq('id', cityData.id);

            mpState.cityId = cityData.id;
            mpState.cityName = cityData.name;
            mpState.cityWeather = cityData.weather;
            mpState.cityEconomyHealth = 1.0;
            mpState.cityAvgPrice = 1.0;
            mpState.cityPlayerCount = 1;
            mpState.cityJoinCode = cityData.join_code;
            mpState.mode = 'city';
            return cityData;
        } catch (err) {
            console.error('Failed to create private city:', err);
            return null;
        }
    },

    async joinCityByCode(code) {
        if (!supabaseClient || !mpState.playerId) return null;
        try {
            const { data: city, error } = await supabaseClient
                .from('cities')
                .select('id, name, weather, economic_health, avg_price, total_businesses, max_players, join_code')
                .eq('join_code', code.toUpperCase().trim())
                .single();

            if (error || !city) return null;

            await supabaseClient.from('city_members').upsert({
                city_id: city.id,
                player_id: mpState.playerId,
                is_active: true
            });

            await supabaseClient.from('cities').update({
                total_businesses: (city.total_businesses || 0) + 1
            }).eq('id', city.id);

            mpState.cityId = city.id;
            mpState.cityName = city.name;
            mpState.cityWeather = city.weather;
            mpState.cityEconomyHealth = city.economic_health || 1.0;
            mpState.cityAvgPrice = city.avg_price || 1.0;
            mpState.cityPlayerCount = (city.total_businesses || 0) + 1;
            mpState.cityJoinCode = city.join_code || null;
            mpState.mode = 'city';

            return city;
        } catch (err) {
            console.error('joinCityByCode failed:', err);
            return null;
        }
    },

    async leaveCity() {
        if (!supabaseClient || !mpState.playerId || !mpState.cityId) return;

        try {
            await supabaseClient.from('city_members')
                .update({ is_active: false })
                .eq('city_id', mpState.cityId)
                .eq('player_id', mpState.playerId);

            await supabaseClient.from('cities').update({
                total_businesses: Math.max(0, mpState.cityPlayerCount - 1)
            }).eq('id', mpState.cityId);

            mpState.cityId = null;
            mpState.cityName = null;
            mpState.mode = 'solo';
        } catch (err) {
            console.warn('Failed to leave city:', err);
        }
    },

    async submitCityDay(cityId, data) {
        if (!supabaseClient || !cityId) throw new Error('Not in a city');

        try {
            const { data: city } = await supabaseClient
                .from('cities')
                .select('*')
                .eq('id', cityId)
                .single();

            if (!city) throw new Error('City not found');

            const { data: recentResults } = await supabaseClient
                .from('day_results')
                .select('player_id, price_set, customers_served')
                .eq('city_id', cityId)
                .order('created_at', { ascending: false })
                .limit(50);

            const avgPrice = city.avg_price || 1.0;
            const priceRatio = data.price / avgPrice;
            let priceScore;
            if (priceRatio <= 0.7) priceScore = 1.5;
            else if (priceRatio <= 0.9) priceScore = 1.2;
            else if (priceRatio <= 1.1) priceScore = 1.0;
            else if (priceRatio <= 1.3) priceScore = 0.7;
            else priceScore = 0.4;

            const repScore = 1.0 + (data.reputation / 100);
            const locScore = 1.0 + ((data.locations || []).length - 1) * 0.2;
            const mktScore = 1.0 + ((data.upgrades || {}).marketing || 0) * 0.1;

            const totalScore = priceScore * repScore * locScore * mktScore;
            const basePool = (city.customer_pool || CITY_CONFIG.BASE_CUSTOMER_POOL) * (city.economic_health || 1.0) * WEATHER[city.weather || 'sunny'].mult;
            const activePlayers = Math.max(1, city.total_businesses || 1);

            const share = (totalScore / (totalScore + activePlayers - 1)) * basePool;
            const customerPoolShare = Math.floor(share * (0.8 + Math.random() * 0.4));

            const competitorPrices = (recentResults || [])
                .filter(function(r) { return r.player_id !== data.playerId; })
                .map(function(r) { return r.price_set; })
                .filter(function(p) { return p != null; });

            const newWeather = getRandomWeather();
            const newEconomy = Math.max(CITY_CONFIG.ECONOMY_MIN, Math.min(CITY_CONFIG.ECONOMY_MAX,
                (city.economic_health || 1.0) + (Math.random() * 0.1 - 0.05)));

            await supabaseClient.from('cities').update({
                weather: newWeather,
                economic_health: newEconomy,
                avg_price: competitorPrices.length > 0
                    ? (competitorPrices.reduce(function(s, p) { return s + p; }, data.price) / (competitorPrices.length + 1))
                    : data.price
            }).eq('id', cityId);

            return {
                customerPoolShare: customerPoolShare,
                cityWeather: city.weather,
                cityAvgPrice: avgPrice,
                competitorPrices: competitorPrices,
                cityRank: null,
                marketCondition: city.economic_health || 1.0
            };
        } catch (err) {
            console.error('City day submission failed:', err);
            throw err;
        }
    },

    async sendChatMessage(cityId, message) {
        if (!supabaseClient || !mpState.playerId || !cityId) return;

        try {
            await supabaseClient.from('chat_messages').insert({
                city_id: cityId,
                player_id: mpState.playerId,
                player_name: mpState.playerName,
                message: message.substring(0, 200)
            });
        } catch (err) {
            console.warn('Chat send failed:', err);
        }
    },

    async fetchChatMessages(cityId, limit) {
        if (!supabaseClient || !cityId) return [];
        limit = limit || 50;

        try {
            const { data } = await supabaseClient
                .from('chat_messages')
                .select('player_name, message, created_at')
                .eq('city_id', cityId)
                .order('created_at', { ascending: false })
                .limit(limit);

            return (data || []).reverse();
        } catch (err) {
            console.warn('Chat fetch failed:', err);
            return [];
        }
    },

    async fetchDailyChallenges() {
        if (!supabaseClient) return [];

        try {
            const today = new Date().toISOString().split('T')[0];
            const { data } = await supabaseClient
                .from('daily_challenges')
                .select('*')
                .eq('challenge_date', today);

            if (data && data.length > 0) return data;

            const challenges = [];
            const shuffled = CHALLENGE_TYPES.sort(function() { return Math.random() - 0.5; }).slice(0, 3);

            for (const tmpl of shuffled) {
                const target = tmpl.baseLine * (1 + Math.random() * 0.5);
                challenges.push({
                    challenge_date: today,
                    challenge_type: tmpl.type,
                    title: tmpl.title,
                    description: tmpl.desc.replace('{target}', Math.floor(target).toString()).replace('${target}', '$' + target.toFixed(2)),
                    target_value: target,
                    reward_type: 'cash_bonus',
                    reward_value: Math.floor(target * 0.5)
                });
            }

            const { data: inserted } = await supabaseClient
                .from('daily_challenges')
                .insert(challenges)
                .select();

            return inserted || [];
        } catch (err) {
            console.warn('Challenges fetch failed:', err);
            return [];
        }
    },

    async submitChallengeCompletion(challengeId, score) {
        if (!supabaseClient || !mpState.playerId) return false;

        try {
            const { error } = await supabaseClient
                .from('challenge_completions')
                .insert({
                    challenge_id: challengeId,
                    player_id: mpState.playerId,
                    score: score
                });

            return !error;
        } catch (err) {
            return false;
        }
    },

    subscribeToCityFeed(cityId, onEvent) {
        if (!supabaseClient || !cityId) return null;

        return supabaseClient
            .channel('city:' + cityId)
            .on('postgres_changes', {
                event: 'INSERT',
                schema: 'public',
                table: 'day_results',
                filter: 'city_id=eq.' + cityId
            }, function(payload) {
                onEvent({ type: 'day_complete', data: payload.new });
            })
            .on('postgres_changes', {
                event: 'UPDATE',
                schema: 'public',
                table: 'cities',
                filter: 'id=eq.' + cityId
            }, function(payload) {
                onEvent({ type: 'city_update', data: payload.new });
            })
            .on('postgres_changes', {
                event: 'INSERT',
                schema: 'public',
                table: 'chat_messages',
                filter: 'city_id=eq.' + cityId
            }, function(payload) {
                onEvent({ type: 'chat', data: payload.new });
            })
            .subscribe();
    },

    unsubscribeAll() {
        if (supabaseClient) {
            supabaseClient.removeAllChannels();
        }
    }
};
