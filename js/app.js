// Music Collection App - Main JavaScript

class MusicApp {
    constructor() {
        this.ratingsData = [];
        this.rotationData = [];
        this.vinylData = [];
        this.goalsData = { daily_goal: 5.5336, weekly_goal: 5.222 };
        this.initialRotationDays = 0; // Store initial rotation time for progress calculation
        // Use current origin for API URL (works for both localhost and Railway)
        this.apiBaseUrl = window.location.origin + '/api';
        this.token = localStorage.getItem('authToken');
        this.isAdmin = !!this.token;
        this.init();
    }

    async init() {
        await this.loadData();
        this.setupEventListeners();
        this.setupAuthListeners();
        this.updateUIForAuth();
        this.renderDashboard();
        await this.renderRatings();
        await this.renderRotation();
        this.renderVinyl();
    }

    async loadData() {
        try {
            console.log('🔄 Cargando datos...');
            
            // Try to load from API first
            const [ratingsResponse, rotationResponse, vinylResponse, goalsResponse] = await Promise.all([
                fetch(`${this.apiBaseUrl}/ratings`),
                fetch(`${this.apiBaseUrl}/rotation`),
                fetch(`${this.apiBaseUrl}/vinyl`),
                fetch(`${this.apiBaseUrl}/goals`)
            ]);

            console.log('📡 Respuestas de API:', {
                ratings: ratingsResponse.ok,
                rotation: rotationResponse.ok,
                vinyl: vinylResponse.ok,
                goals: goalsResponse.ok
            });

            if (ratingsResponse.ok && rotationResponse.ok && vinylResponse.ok) {
                this.ratingsData = await ratingsResponse.json();
                this.rotationData = await rotationResponse.json();
                this.vinylData = await vinylResponse.json();
                
                if (goalsResponse.ok) {
                    this.goalsData = await goalsResponse.json();
                    // Set initial goals if not present in data
                    if (!this.goalsData.initial_daily_goal) {
                        this.goalsData.initial_daily_goal = 5.3722;
                    }
                    if (!this.goalsData.initial_weekly_goal) {
                        this.goalsData.initial_weekly_goal = 5.6236;
                    }
                }
                
                // Calculate initial rotation days for progress tracking
                const totalMinutes = this.rotationData.reduce((sum, album) => sum + (album.remaining || 0), 0);
                this.initialRotationDays = (totalMinutes / 60) / 24;
                
                console.log('✅ Datos cargados desde API:', {
                    ratings: this.ratingsData.length,
                    rotation: this.rotationData.length,
                    vinyl: this.vinylData.length,
                    goals: this.goalsData,
                    initialRotationDays: this.initialRotationDays
                });
            } else {
                // Fallback to direct file loading if API is not available
                console.warn('⚠️ API not available, falling back to direct file loading');
                const [ratingsJSON, rotationJSON, vinylJSON] = await Promise.all([
                    fetch('data/albums-rating.json').then(r => r.json()),
                    fetch('data/albums-rotation.json').then(r => r.json()),
                    fetch('data/vinyl-list.json').then(r => r.json())
                ]);

                this.ratingsData = ratingsJSON;
                this.rotationData = rotationJSON;
                this.vinylData = vinylJSON;

                // Calculate initial rotation days for progress tracking
                const totalMinutes = this.rotationData.reduce((sum, album) => sum + (album.remaining || 0), 0);
                this.initialRotationDays = (totalMinutes / 60) / 24;

                console.log('📁 Datos cargados desde archivos:', {
                    ratings: this.ratingsData.length,
                    rotation: this.rotationData.length,
                    vinyl: this.vinylData.length,
                    initialRotationDays: this.initialRotationDays
                });
            }
        } catch (error) {
            console.error('❌ Error cargando datos:', error);
            // Try localStorage as last resort
            const storedRotation = localStorage.getItem('rotationData');
            const storedRatings = localStorage.getItem('ratingsData');
            const storedVinyl = localStorage.getItem('vinylData');
            const storedGoals = localStorage.getItem('goalsData');
            
            if (storedRotation && storedRatings) {
                this.rotationData = JSON.parse(storedRotation);
                this.ratingsData = JSON.parse(storedRatings);
                console.log('💾 Datos cargados desde localStorage (fallback)');
                
                // Calculate initial rotation days for progress tracking
                const totalMinutes = this.rotationData.reduce((sum, album) => sum + (album.remaining || 0), 0);
                this.initialRotationDays = (totalMinutes / 60) / 24;
            }
            
            if (storedVinyl) {
                this.vinylData = JSON.parse(storedVinyl);
                console.log('💾 Datos de vinilos cargados desde localStorage (fallback)');
            }
            
            if (storedGoals) {
                this.goalsData = JSON.parse(storedGoals);
            }
        }
    }

    parseCSV(csv, type) {
        const lines = csv.split('\n').filter(line => line.trim());
        const headers = lines[0].split(',').map(h => h.trim());
        const data = [];

        for (let i = 1; i < lines.length; i++) {
            const values = this.parseCSVLine(lines[i]);
            if (values.length < headers.length) continue;

            const obj = {};
            headers.forEach((header, index) => {
                obj[header] = values[index] ? values[index].trim() : '';
            });

            // Procesar según el tipo
            if (type === 'ratings' && obj['No'] && obj['Nombre']) {
                obj.rate = this.parseRate(obj['Rate']);
                obj.avgRate = this.parseRate(obj['Avg. Rate']);
                obj.porcentaje = this.parsePercentage(obj['porcentaje de canciones que me gustan']);
                data.push(obj);
            } else if (type === 'rotation' && obj['No'] && obj['Nombre']) {
                obj.escuchasPendientes = parseInt(obj['Escuchas pendientes']) || 0;
                obj.minutos = parseInt(obj['Minutos']) || 0;
                obj.restantes = parseInt(obj['Restantes']) || 0;
                data.push(obj);
            } else if (type === 'vinyl' && obj['No'] && obj['Nombre']) {
                obj.rate = this.parseRate(obj['Rate']);
                obj.avgRate = this.parseRate(obj['Avg. Rate']);
                data.push(obj);
            }
        }

        return data;
    }

    parseCSVLine(line) {
        const result = [];
        let current = '';
        let inQuotes = false;

        for (let i = 0; i < line.length; i++) {
            const char = line[i];
            if (char === '"') {
                inQuotes = !inQuotes;
            } else if (char === ',' && !inQuotes) {
                result.push(current);
                current = '';
            } else {
                current += char;
            }
        }
        result.push(current);
        return result;
    }

    parseRate(rateStr) {
        if (!rateStr) return 0;
        // Reemplazar coma por punto para decimales
        const normalized = rateStr.replace(',', '.');
        const parsed = parseFloat(normalized);
        return isNaN(parsed) ? 0 : parsed;
    }

    parsePercentage(percentStr) {
        if (!percentStr) return 0;
        const normalized = percentStr.replace(',', '.').replace('%', '');
        const parsed = parseFloat(normalized);
        return isNaN(parsed) ? 0 : parsed;
    }

    setupEventListeners() {
        // Tabs
        document.querySelectorAll('.tab').forEach(tab => {
            tab.addEventListener('click', (e) => {
                document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
                document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
                e.target.classList.add('active');
                document.getElementById(e.target.dataset.tab).classList.add('active');
            });
        });

        // Dashboard tabs
        document.querySelectorAll('.dashboard-tab').forEach(tab => {
            tab.addEventListener('click', (e) => {
                document.querySelectorAll('.dashboard-tab').forEach(t => t.classList.remove('active'));
                document.querySelectorAll('.dashboard-section').forEach(s => s.classList.remove('active'));
                e.target.classList.add('active');
                const sectionId = `dashboard-${e.target.dataset.dashboardTab}`;
                document.getElementById(sectionId).classList.add('active');
            });
        });

        // Ratings filters
        document.getElementById('search-ratings').addEventListener('input', async () => await this.renderRatings());
        document.getElementById('filter-genre').addEventListener('change', async () => await this.renderRatings());
        document.getElementById('filter-country').addEventListener('change', async () => await this.renderRatings());
        document.getElementById('filter-decade').addEventListener('change', async () => await this.renderRatings());
        document.getElementById('sort-ratings').addEventListener('change', async () => await this.renderRatings());

        // Rotation filters
        document.getElementById('search-rotation').addEventListener('input', async () => await this.renderRotation());
        document.getElementById('filter-rotation-genre').addEventListener('change', async () => await this.renderRotation());
        document.getElementById('filter-rotation-listened').addEventListener('change', async () => await this.renderRotation());
        document.getElementById('filter-rotation-pending').addEventListener('change', async () => await this.renderRotation());

        // Goals modal
        document.getElementById('edit-goals-btn').addEventListener('click', () => {
            if (!this.isAdmin) return;
            this.openGoalsModal();
        });
        document.getElementById('save-goals-btn').addEventListener('click', () => {
            if (!this.isAdmin) return;
            this.saveGoals();
        });

        // Add vinyl modal
        const addVinylBtn = document.getElementById('add-vinyl-btn');
        if (addVinylBtn) {
            addVinylBtn.addEventListener('click', () => this.openAddVinylModal());
        }

        const saveVinylBtn = document.getElementById('save-vinyl-btn');
        if (saveVinylBtn) {
            saveVinylBtn.addEventListener('click', () => this.saveVinyl());
        }

        // Add rotation album modal
        const addRotationBtn = document.getElementById('add-rotation-album-btn');
        if (addRotationBtn) {
            addRotationBtn.addEventListener('click', () => this.openAddRotationModal());
        }

        const saveRotationBtn = document.getElementById('save-rotation-btn');
        if (saveRotationBtn) {
            saveRotationBtn.addEventListener('click', () => this.saveRotationAlbum());
        }

        const addRotationModal = document.getElementById('add-rotation-modal');
        if (addRotationModal) {
            addRotationModal.addEventListener('click', (e) => {
                if (e.target.id === 'add-rotation-modal') {
                    addRotationModal.classList.remove('active');
                }
            });
        }

        // Edit song rating modal
        const editSongRatingModal = document.getElementById('edit-song-rating-modal');
        if (editSongRatingModal) {
            editSongRatingModal.addEventListener('click', (e) => {
                if (e.target.id === 'edit-song-rating-modal') {
                    editSongRatingModal.classList.remove('active');
                }
            });
        }

        const saveSongRatingBtn = document.getElementById('save-song-rating-btn');
        if (saveSongRatingBtn) {
            saveSongRatingBtn.addEventListener('click', () => this.saveSongRatingEdit());
        }

        const minRatingInput = document.getElementById('edit-song-min-rating');
        const maxRatingInput = document.getElementById('edit-song-max-rating');
        if (minRatingInput && maxRatingInput) {
            const updateCalculatedRating = () => {
                const min = parseFloat(minRatingInput.value) || 0;
                const max = parseFloat(maxRatingInput.value) || 0;
                const calculated = (min + max) / 2;
                document.getElementById('edit-song-calculated-rating').textContent = calculated.toFixed(3);
            };
            minRatingInput.addEventListener('input', updateCalculatedRating);
            maxRatingInput.addEventListener('input', updateCalculatedRating);
        }

        // Reset listened status button
        const resetListenedBtn = document.getElementById('reset-listened-btn');
        if (resetListenedBtn) {
            resetListenedBtn.addEventListener('click', () => this.resetAllListenedStatus());
        }

        // Reset rotation listened status button
        const resetRotationListenedBtn = document.getElementById('reset-rotation-listened-btn');
        if (resetRotationListenedBtn) {
            resetRotationListenedBtn.addEventListener('click', () => this.resetRotationListenedStatus());
        }

        // Vinyl filters
        document.getElementById('search-vinyl').addEventListener('input', () => this.renderVinyl());
        document.getElementById('filter-vinyl-genre').addEventListener('change', () => this.renderVinyl());
        document.getElementById('filter-vinyl-country').addEventListener('change', () => this.renderVinyl());
        document.getElementById('filter-vinyl-decade').addEventListener('change', () => this.renderVinyl());
        document.getElementById('filter-vinyl-color').addEventListener('change', () => this.renderVinyl());
        document.getElementById('filter-vinyl-status').addEventListener('change', () => this.renderVinyl());
        document.getElementById('sort-vinyl').addEventListener('change', () => this.renderVinyl());

        // Modal close on backdrop click
        document.getElementById('album-modal').addEventListener('click', (e) => {
            if (e.target.id === 'album-modal') {
                e.target.classList.remove('active');
            }
        });

        // Goals modal close on backdrop click
        const goalsModal = document.getElementById('goals-modal');
        if (goalsModal) {
            goalsModal.addEventListener('click', (e) => {
                if (e.target.id === 'goals-modal') {
                    goalsModal.classList.remove('active');
                }
            });
        }

        // Add vinyl modal close on backdrop click
        const addVinylModal = document.getElementById('add-vinyl-modal');
        if (addVinylModal) {
            addVinylModal.addEventListener('click', (e) => {
                if (e.target.id === 'add-vinyl-modal') {
                    addVinylModal.classList.remove('active');
                }
            });
        }

        // Rating modal close on backdrop click
        const ratingModal = document.getElementById('rating-modal');
        if (ratingModal) {
            ratingModal.addEventListener('click', (e) => {
                if (e.target.id === 'rating-modal') {
                    ratingModal.classList.remove('active');
                }
            });
        }

        // Modal close on Escape key
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                document.getElementById('album-modal').classList.remove('active');
                const ratingModal = document.getElementById('rating-modal');
                if (ratingModal) {
                    ratingModal.classList.remove('active');
                }
                const goalsModal = document.getElementById('goals-modal');
                if (goalsModal) {
                    goalsModal.classList.remove('active');
                }
                const addVinylModal = document.getElementById('add-vinyl-modal');
                if (addVinylModal) {
                    addVinylModal.classList.remove('active');
                }
                const editSongRatingModal = document.getElementById('edit-song-rating-modal');
                if (editSongRatingModal) {
                    editSongRatingModal.classList.remove('active');
                }
            }
        });
    }

    // Dashboard Methods
    renderDashboard() {
        // Estadísticas básicas de álbumes calificados
        document.getElementById('total-rated').textContent = this.ratingsData.length;

        const avgRating = this.ratingsData.length > 0
            ? this.ratingsData.reduce((sum, album) => sum + album.rate, 0) / this.ratingsData.length
            : 0;
        document.getElementById('avg-rating').textContent = avgRating.toFixed(2);

        // Estadísticas básicas de vinilos
        document.getElementById('total-vinyl').textContent = this.vinylData.length;

        const vinylAvgRating = this.vinylData.length > 0
            ? this.vinylData.reduce((sum, album) => sum + (album.rate || 0), 0) / this.vinylData.filter(a => a.rate).length
            : 0;
        document.getElementById('vinyl-avg-rating').textContent = vinylAvgRating.toFixed(2);

        // Gráficas de álbumes calificados
        this.renderRatingsCountryChart();
        this.renderRatingsDecadeChart();
        this.renderRatingsYearChart();
        this.renderRatingsGenreChart();
        this.renderRatingDistribution();
        this.renderTopArtists();
        this.renderTopSongs();

        // Gráficas de vinilos
        this.renderVinylCountryChart();
        this.renderVinylDecadeChart();
        this.renderVinylYearChart();
        this.renderVinylGenreChart();
        this.renderVinylTopArtists();
    }

    renderRatingDistribution() {
        const chartContainer = document.getElementById('rating-distribution-chart');
        if (!chartContainer) return;

        const ratingRanges = {
            '5': 0,
            '4.9': 0,
            '4.8': 0,
            '4.7': 0,
            '4.6': 0,
            '4.5': 0,
            '4.4': 0,
            '4.3': 0,
            '4.2': 0,
            '4.1': 0
        };

        this.ratingsData.forEach(album => {
            const rate = album.rate;
            if (rate === 5.0) ratingRanges['5']++;
            else if (rate >= 4.90 && rate < 5.0) ratingRanges['4.9']++;
            else if (rate >= 4.80 && rate < 4.90) ratingRanges['4.8']++;
            else if (rate >= 4.70 && rate < 4.80) ratingRanges['4.7']++;
            else if (rate >= 4.60 && rate < 4.70) ratingRanges['4.6']++;
            else if (rate >= 4.50 && rate < 4.60) ratingRanges['4.5']++;
            else if (rate >= 4.40 && rate < 4.50) ratingRanges['4.4']++;
            else if (rate >= 4.30 && rate < 4.40) ratingRanges['4.3']++;
            else if (rate >= 4.20 && rate < 4.30) ratingRanges['4.2']++;
            else if (rate >= 4.10 && rate < 4.20) ratingRanges['4.1']++;
        });

        const maxCount = Math.max(...Object.values(ratingRanges));
        const isMobile = window.innerWidth <= 768;
        chartContainer.innerHTML = '';

        Object.entries(ratingRanges).forEach(([range, count]) => {
            const bar = document.createElement('div');
            bar.className = 'bar';

            if (isMobile) {
                const width = (count / maxCount) * 100;
                bar.style.width = `${width}%`;

                // Si la barra es muy corta, poner el valor fuera
                const valueClass = width < 20 ? 'bar-value bar-value-outside' : 'bar-value';
                bar.innerHTML = `
                    <span class="${valueClass}">${count}</span>
                    <span class="bar-label">${range}</span>
                `;
            } else {
                const height = (count / maxCount) * 150;
                bar.style.height = `${height}px`;
                bar.innerHTML = `
                    <span class="bar-value">${count}</span>
                    <span class="bar-label">${range}</span>
                `;
            }
            chartContainer.appendChild(bar);
        });
    }

    renderTopArtists() {
        const container = document.getElementById('top-artists-list');
        if (!container) return;

        const artistCounts = {};
        this.ratingsData.forEach(album => {
            const artist = album.artist || 'Desconocido';
            artistCounts[artist] = (artistCounts[artist] || 0) + 1;
        });

        const topArtists = Object.entries(artistCounts)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 15);

        container.innerHTML = '';

        topArtists.forEach(([artist, count], index) => {
            const item = document.createElement('div');
            item.className = 'top-album-card';
            item.style.cursor = 'default';
            item.innerHTML = `
                <div class="top-album-rank">${index + 1}</div>
                <div class="top-album-info">
                    <div class="top-album-name">${artist}</div>
                    <div class="top-album-artist">${count} álbum${count > 1 ? 'es' : ''}</div>
                </div>
            `;
            container.appendChild(item);
        });
    }

    renderAdvancedStats() {
        // Eliminar estadísticas anteriores si existen
        const existingStats = document.querySelector('#dashboard .charts-section:not(.chart-container)');
        if (existingStats) {
            existingStats.remove();
        }

        // Calcular estadísticas adicionales
        const totalSongs = this.ratingsData.reduce((sum, album) => sum + (album.songs?.length || 0), 0);
        const avgLikePercentage = this.ratingsData.reduce((sum, album) => sum + (album.like_percentage || 0), 0) / this.ratingsData.length;
        const avgDuration = this.ratingsData.reduce((sum, album) => sum + (album.duration || 0), 0) / this.ratingsData.length;

        // Encontrar año más antiguo y más reciente
        const years = this.ratingsData.map(album => parseInt(album.year)).filter(y => !isNaN(y));
        const oldestYear = Math.min(...years);
        const newestYear = Math.max(...years);

        // País con más álbumes
        const countryCounts = {};
        this.ratingsData.forEach(album => {
            const country = album.country || 'Desconocido';
            countryCounts[country] = (countryCounts[country] || 0) + 1;
        });
        const topCountry = Object.entries(countryCounts).sort((a, b) => b[1] - a[1])[0];

        // Crear cards adicionales
        const advancedStatsHTML = `
            <div class="charts-section">
                <div class="stat-card">
                    <h3>Total Canciones</h3>
                    <p class="stat-number">${totalSongs}</p>
                </div>
                <div class="stat-card">
                    <h3>Promedio Likes</h3>
                    <p class="stat-number">${avgLikePercentage.toFixed(1)}%</p>
                </div>
                <div class="stat-card">
                    <h3>Duración Promedio</h3>
                    <p class="stat-number">${avgDuration.toFixed(0)} min</p>
                </div>
                <div class="stat-card">
                    <h3>Rango de Años</h3>
                    <p class="stat-number">${oldestYear}-${newestYear}</p>
                </div>
                <div class="stat-card">
                    <h3>País Principal</h3>
                    <p class="stat-number">${topCountry[0]}</p>
                </div>
                <div class="stat-card">
                    <h3>Álbumes en ${topCountry[0]}</h3>
                    <p class="stat-number">${topCountry[1]}</p>
                </div>
            </div>
        `;

        // Insertar después de stats-grid
        const statsGrid = document.querySelector('#dashboard .stats-grid');
        statsGrid.insertAdjacentHTML('afterend', advancedStatsHTML);
    }

    // Ratings Charts
    getCountryFlag(countryName) {
        const countryFlags = {
            'Estados Unidos': '🇺🇸',
            'Reino Unido': '🇬🇧',
            'Inglaterra': '🏴󠁧󠁢󠁥󠁮󠁧󠁿',
            'España': '🇪🇸',
            'Francia': '🇫🇷',
            'Alemania': '🇩🇪',
            'Italia': '🇮🇹',
            'Japón': '🇯🇵',
            'Brasil': '🇧🇷',
            'Argentina': '🇦🇷',
            'Canada': '🇨🇦',
            'Australia': '🇦🇺',
            'México': '🇲🇽',
            'Países Bajos': '🇳🇱',
            'Suecia': '🇸🇪',
            'Noruega': '🇳🇴',
            'Dinamarca': '🇩🇰',
            'Bélgica': '🇧🇪',
            'Suiza': '🇨🇭',
            'Austria': '🇦🇹',
            'Portugal': '🇵🇹',
            'Colombia': '🇨🇴',
            'Chile': '🇨🇱',
            'Perú': '🇵🇪',
            'Venezuela': '🇻🇪',
            'Uruguay': '🇺🇾',
            'Paraguay': '🇵🇾',
            'Ecuador': '🇪🇨',
            'Bolivia': '🇧🇴',
            'Cuba': '🇨🇺',
            'Puerto Rico': '🇵🇷',
            'República Dominicana': '🇩🇴',
            'Haití': '🇭🇹',
            'Jamaica': '🇯🇲',
            'Trinidad y Tobago': '🇹🇹',
            'Panama': '🇵🇦',
            'Costa Rica': '🇨🇷',
            'Guatemala': '🇬🇹',
            'Honduras': '🇭🇳',
            'El Salvador': '🇸🇻',
            'Nicaragua': '🇳🇮',
            'India': '🇮🇳',
            'China': '🇨🇳',
            'Corea del Sur': '🇰🇷',
            'Rusia': '🇷🇺',
            'Turquía': '🇹🇷',
            'Grecia': '🇬🇷',
            'Polonia': '🇵🇱',
            'República Checa': '🇨🇿',
            'Hungría': '🇭🇺',
            'Rumania': '🇷🇴',
            'Bulgaria': '🇧🇬',
            'Serbia': '🇷🇸',
            'Croacia': '🇭🇷',
            'Eslovenia': '🇸🇮',
            'Eslovaquia': '🇸🇰',
            'Finlandia': '🇫🇮',
            'Irlanda': '🇮🇪',
            'Islandia': '🇮🇸',
            'Nueva Zelanda': '🇳🇿',
            'Sudáfrica': '🇿🇦',
            'Egipto': '🇪🇬',
            'Marruecos': '🇲🇦',
            'Túnez': '🇹🇳',
            'Argelia': '🇩🇿',
            'Nigeria': '🇳🇬',
            'Kenia': '🇰🇪',
            'Etiopía': '🇪🇹',
            'Ghana': '🇬🇭',
            'Senegal': '🇸🇳',
            'Costa de Marfil': '🇨🇮',
            'Camerún': '🇨🇲',
            'Angola': '🇦🇴',
            'Mozambique': '🇲🇿',
            'Zambia': '🇿🇲',
            'Zimbabue': '🇿🇼',
            'Botsuana': '🇧🇼',
            'Namibia': '🇳🇦',
            'Malaui': '🇲🇼',
            'Uganda': '🇺🇬',
            'Tanzania': '🇹🇿',
            'Ruanda': '🇷🇼',
            'Burundi': '🇧🇮',
            'Somalia': '🇸🇴',
            'Líbano': '🇱🇧',
            'Siria': '🇸🇾',
            'Jordania': '🇯🇴',
            'Israel': '🇮🇱',
            'Irak': '🇮🇶',
            'Irán': '🇮🇷',
            'Afganistán': '🇦🇫',
            'Pakistán': '🇵🇰',
            'Bangladés': '🇧🇩',
            'Sri Lanka': '🇱🇰',
            'Nepal': '🇳🇵',
            'Bután': '🇧🇹',
            'Myanmar': '🇲🇲',
            'Tailandia': '🇹🇭',
            'Vietnam': '🇻🇳',
            'Camboya': '🇰🇭',
            'Laos': '🇱🇦',
            'Malasia': '🇲🇾',
            'Singapur': '🇸🇬',
            'Indonesia': '🇮🇩',
            'Filipinas': '🇵🇭',
            'Taiwán': '🇹🇼',
            'Hong Kong': '🇭🇰',
            'Macao': '🇲🇴',
            'Mongolia': '🇲🇳',
            'Kazajistán': '🇰🇿',
            'Uzbekistán': '🇺🇿',
            'Turkmenistán': '🇹🇲',
            'Kirguistán': '🇰🇬',
        };
        return countryFlags[countryName] || '🌍';
    }

    renderRatingsCountryChart() {
        const chartContainer = document.getElementById('ratings-country-chart');
        if (!chartContainer) return;

        const countryCounts = {};
        this.ratingsData.forEach(album => {
            const country = album.country || 'Desconocido';
            countryCounts[country] = (countryCounts[country] || 0) + 1;
        });

        const sortedCountries = Object.entries(countryCounts)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 15);

        const maxCount = Math.max(...sortedCountries.map(c => c[1]));
        const isMobile = window.innerWidth <= 768;
        chartContainer.innerHTML = '';

        sortedCountries.forEach(([country, count]) => {
            const bar = document.createElement('div');
            bar.className = 'bar';
            const flag = this.getCountryFlag(country);

            if (isMobile) {
                const width = (count / maxCount) * 100;
                bar.style.width = `${width}%`;
                const isShortBar = width < 20;
                if (isShortBar) {
                    bar.innerHTML = `
                        <span class="bar-value bar-value-outside">${count}</span>
                        <span class="country-flag" tabindex="0" role="button" aria-label="${country}">${flag}</span>
                        <span class="country-tooltip">${country}</span>
                    `;
                } else {
                    bar.innerHTML = `
                        <span class="bar-value">${count}</span>
                        <span class="country-flag" tabindex="0" role="button" aria-label="${country}">${flag}</span>
                        <span class="country-tooltip">${country}</span>
                    `;
                }
            } else {
                const height = (count / maxCount) * 150;
                bar.style.height = `${height}px`;
                bar.innerHTML = `
                    <span class="bar-value">${count}</span>
                    <span class="country-flag">${flag}</span>
                    <span class="country-tooltip">${country}</span>
                `;
            }
            chartContainer.appendChild(bar);
        });
    }

    renderRatingsDecadeChart() {
        const chartContainer = document.getElementById('ratings-decade-chart');
        if (!chartContainer) return;

        const decadeCounts = {};
        this.ratingsData.forEach(album => {
            const year = parseInt(album.year);
            if (!isNaN(year)) {
                const decade = Math.floor(year / 10) * 10;
                const decadeLabel = `${decade}s`;
                decadeCounts[decadeLabel] = (decadeCounts[decadeLabel] || 0) + 1;
            }
        });

        const sortedDecades = Object.entries(decadeCounts)
            .sort((a, b) => parseInt(a[0]) - parseInt(b[0]));

        const maxCount = Math.max(...sortedDecades.map(d => d[1]));
        chartContainer.innerHTML = '';

        sortedDecades.forEach(([decade, count]) => {
            const height = (count / maxCount) * 150;
            const bar = document.createElement('div');
            bar.className = 'bar';
            bar.style.height = `${height}px`;
            bar.innerHTML = `
                <span class="bar-value">${count}</span>
                <span class="bar-label">${decade}</span>
            `;
            chartContainer.appendChild(bar);
        });
    }

    renderRatingsYearChart() {
        const chartContainer = document.getElementById('ratings-year-chart');
        if (!chartContainer) return;

        const yearCounts = {};
        this.ratingsData.forEach(album => {
            const year = parseInt(album.year);
            if (!isNaN(year)) {
                yearCounts[year] = (yearCounts[year] || 0) + 1;
            }
        });

        // Generate all years from 1955 to 2026
        const allYears = [];
        for (let year = 1955; year <= 2026; year++) {
            allYears.push(year);
        }

        const maxCount = Math.max(...Object.values(yearCounts), 1);
        chartContainer.innerHTML = '';

        allYears.forEach(year => {
            const count = yearCounts[year] || 0;
            const width = (count / maxCount) * 100;
            const bar = document.createElement('div');
            bar.className = 'bar';
            bar.style.width = `${width}%`;
            bar.innerHTML = `
                <span class="bar-value">${count > 0 ? count : ''}</span>
                <span class="bar-label">${year}</span>
            `;
            chartContainer.appendChild(bar);
        });
    }

    renderRatingsGenreChart() {
        const chartContainer = document.getElementById('ratings-genre-chart');
        if (!chartContainer) return;

        const genreCounts = {};
        this.ratingsData.forEach(album => {
            const genre = album.main_genre || 'Otros';
            genreCounts[genre] = (genreCounts[genre] || 0) + 1;
        });

        const sortedGenres = Object.entries(genreCounts)
            .sort((a, b) => b[1] - a[1]);

        const maxCount = Math.max(...sortedGenres.map(g => g[1]));
        const isMobile = window.innerWidth <= 768;
        chartContainer.innerHTML = '';

        sortedGenres.forEach(([genre, count]) => {
            const bar = document.createElement('div');
            bar.className = 'bar';

            if (isMobile) {
                const width = (count / maxCount) * 100;
                bar.style.width = `${width}%`;
                bar.innerHTML = `
                    <span class="bar-value">${count}</span>
                    <span class="bar-label">${genre}</span>
                    <span class="genre-tooltip-mobile">${genre}</span>
                `;
                bar.tabIndex = 0;
                bar.setAttribute('role', 'button');
                bar.setAttribute('aria-label', `${genre}: ${count} álbumes`);
            } else {
                const height = (count / maxCount) * 150;
                bar.style.height = `${height}px`;
                bar.innerHTML = `
                    <span class="bar-value">${count}</span>
                    <span class="genre-tooltip">${genre}</span>
                `;
            }
            chartContainer.appendChild(bar);
        });
    }

    renderTopSongs() {
        const container = document.getElementById('top-songs-list');
        if (!container) return;

        const allSongs = [];
        this.ratingsData.forEach(album => {
            if (album.songs && Array.isArray(album.songs)) {
                album.songs.forEach(song => {
                    allSongs.push({
                        name: song.name,
                        rate: song.rate,
                        album: album.name,
                        artist: album.artist,
                        image: album.image
                    });
                });
            }
        });

        const topSongs = allSongs
            .sort((a, b) => b.rate - a.rate)
            .slice(0, 200);

        container.innerHTML = '';

        topSongs.forEach((song, index) => {
            const item = document.createElement('div');
            item.className = 'top-song-card';
            item.innerHTML = `
                <div class="top-song-rank">${index + 1}</div>
                <img class="top-song-image" src="${song.image || 'https://via.placeholder.com/60'}" alt="${song.album}" onerror="this.src='https://via.placeholder.com/60'">
                <div class="top-song-info">
                    <div class="top-song-name">${song.name}</div>
                    <div class="top-song-album">${song.album}</div>
                    <div class="top-song-artist">${song.artist}</div>
                </div>
                <div class="top-song-rating">${song.rate.toFixed(3)}</div>
            `;
            container.appendChild(item);
        });
    }

    // Vinyl Charts
    renderVinylCountryChart() {
        const chartContainer = document.getElementById('vinyl-country-chart');
        if (!chartContainer) return;

        const countryCounts = {};
        this.vinylData.forEach(album => {
            const country = album.country || 'Desconocido';
            countryCounts[country] = (countryCounts[country] || 0) + 1;
        });

        const sortedCountries = Object.entries(countryCounts)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 15);

        const maxCount = Math.max(...sortedCountries.map(c => c[1]));
        const isMobile = window.innerWidth <= 768;
        chartContainer.innerHTML = '';

        sortedCountries.forEach(([country, count]) => {
            const bar = document.createElement('div');
            bar.className = 'bar';
            const flag = this.getCountryFlag(country);

            if (isMobile) {
                const width = (count / maxCount) * 100;
                bar.style.width = `${width}%`;
                const isShortBar = width < 20;
                if (isShortBar) {
                    bar.innerHTML = `
                        <span class="bar-value bar-value-outside">${count}</span>
                        <span class="country-flag" tabindex="0" role="button" aria-label="${country}">${flag}</span>
                        <span class="country-tooltip">${country}</span>
                    `;
                } else {
                    bar.innerHTML = `
                        <span class="bar-value">${count}</span>
                        <span class="country-flag" tabindex="0" role="button" aria-label="${country}">${flag}</span>
                        <span class="country-tooltip">${country}</span>
                    `;
                }
            } else {
                const height = (count / maxCount) * 150;
                bar.style.height = `${height}px`;
                bar.innerHTML = `
                    <span class="bar-value">${count}</span>
                    <span class="country-flag">${flag}</span>
                    <span class="country-tooltip">${country}</span>
                `;
            }
            chartContainer.appendChild(bar);
        });
    }

    renderVinylDecadeChart() {
        const chartContainer = document.getElementById('vinyl-decade-chart');
        if (!chartContainer) return;

        const decadeCounts = {};
        this.vinylData.forEach(album => {
            const year = parseInt(album.year);
            if (!isNaN(year)) {
                const decade = Math.floor(year / 10) * 10;
                const decadeLabel = `${decade}s`;
                decadeCounts[decadeLabel] = (decadeCounts[decadeLabel] || 0) + 1;
            }
        });

        const sortedDecades = Object.entries(decadeCounts)
            .sort((a, b) => parseInt(a[0]) - parseInt(b[0]));

        const maxCount = Math.max(...sortedDecades.map(d => d[1]));
        chartContainer.innerHTML = '';

        sortedDecades.forEach(([decade, count]) => {
            const height = (count / maxCount) * 150;
            const bar = document.createElement('div');
            bar.className = 'bar';
            bar.style.height = `${height}px`;
            bar.innerHTML = `
                <span class="bar-value">${count}</span>
                <span class="bar-label">${decade}</span>
            `;
            chartContainer.appendChild(bar);
        });
    }

    renderVinylYearChart() {
        const chartContainer = document.getElementById('vinyl-year-chart');
        if (!chartContainer) return;

        const yearCounts = {};
        this.vinylData.forEach(album => {
            const year = parseInt(album.year);
            if (!isNaN(year)) {
                yearCounts[year] = (yearCounts[year] || 0) + 1;
            }
        });

        // Generate all years from 1955 to 2026
        const allYears = [];
        for (let year = 1955; year <= 2026; year++) {
            allYears.push(year);
        }

        const maxCount = Math.max(...Object.values(yearCounts), 1);
        chartContainer.innerHTML = '';

        allYears.forEach(year => {
            const count = yearCounts[year] || 0;
            const width = (count / maxCount) * 100;
            const bar = document.createElement('div');
            bar.className = 'bar';
            bar.style.width = `${width}%`;
            bar.innerHTML = `
                <span class="bar-value">${count > 0 ? count : ''}</span>
                <span class="bar-label">${year}</span>
            `;
            chartContainer.appendChild(bar);
        });
    }

    renderVinylGenreChart() {
        const chartContainer = document.getElementById('vinyl-genre-chart');
        if (!chartContainer) return;

        const genreCounts = {};
        this.vinylData.forEach(album => {
            const genre = album.main_genre || 'Otros';
            genreCounts[genre] = (genreCounts[genre] || 0) + 1;
        });

        const sortedGenres = Object.entries(genreCounts)
            .sort((a, b) => b[1] - a[1]);

        const maxCount = Math.max(...sortedGenres.map(g => g[1]));
        const isMobile = window.innerWidth <= 768;
        chartContainer.innerHTML = '';

        sortedGenres.forEach(([genre, count]) => {
            const bar = document.createElement('div');
            bar.className = 'bar';

            if (isMobile) {
                const width = (count / maxCount) * 100;
                bar.style.width = `${width}%`;
                bar.innerHTML = `
                    <span class="bar-value">${count}</span>
                    <span class="bar-label">${genre}</span>
                    <span class="genre-tooltip-mobile">${genre}</span>
                `;
                bar.tabIndex = 0;
                bar.setAttribute('role', 'button');
                bar.setAttribute('aria-label', `${genre}: ${count} vinilos`);
            } else {
                const height = (count / maxCount) * 150;
                bar.style.height = `${height}px`;
                bar.innerHTML = `
                    <span class="bar-value">${count}</span>
                    <span class="genre-tooltip">${genre}</span>
                `;
            }
            chartContainer.appendChild(bar);
        });
    }

    renderVinylTopArtists() {
        const container = document.getElementById('vinyl-top-artists-list');
        if (!container) return;

        const artistCounts = {};
        this.vinylData.forEach(album => {
            const artist = album.artist || 'Desconocido';
            artistCounts[artist] = (artistCounts[artist] || 0) + 1;
        });

        const topArtists = Object.entries(artistCounts)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 15);

        container.innerHTML = '';

        topArtists.forEach(([artist, count], index) => {
            const item = document.createElement('div');
            item.className = 'top-album-card';
            item.style.cursor = 'default';
            item.innerHTML = `
                <div class="top-album-rank">${index + 1}</div>
                <div class="top-album-info">
                    <div class="top-album-name">${artist}</div>
                    <div class="top-album-artist">${count} vinilo${count > 1 ? 's' : ''}</div>
                </div>
            `;
            container.appendChild(item);
        });
    }

    renderGenreChart() {
        const chartContainer = document.getElementById('genre-chart');
        if (!chartContainer) return;

        const genreCounts = {};
        this.ratingsData.forEach(album => {
            const genre = album.main_genre || 'Otros';
            genreCounts[genre] = (genreCounts[genre] || 0) + 1;
        });

        const sortedGenres = Object.entries(genreCounts)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 8);

        const maxCount = Math.max(...sortedGenres.map(g => g[1]));
        chartContainer.innerHTML = '';

        sortedGenres.forEach(([genre, count]) => {
            const height = (count / maxCount) * 150;
            const bar = document.createElement('div');
            bar.className = 'bar';
            bar.style.height = `${height}px`;
            bar.innerHTML = `
                <span class="bar-value">${count}</span>
                <span class="bar-label">${genre.substring(0, 10)}${genre.length > 10 ? '...' : ''}</span>
            `;
            chartContainer.appendChild(bar);
        });
    }

    renderTopAlbums() {
        const container = document.getElementById('top-albums-list');
        if (!container) return;

        const topAlbums = [...this.ratingsData]
            .sort((a, b) => b.rate - a.rate)
            .slice(0, 10);

        container.innerHTML = '';

        topAlbums.forEach((album, index) => {
            const card = this.createTopAlbumCard(album, index + 1);
            container.appendChild(card);
        });
    }

    createTopAlbumCard(album, rank) {
        const card = document.createElement('div');
        card.className = 'top-album-card';
        card.dataset.albumIndex = this.ratingsData.indexOf(album);
        card.addEventListener('click', () => this.showAlbumDetails(album));

        const stars = this.getAlbumStarRating(album.rate);
        const listenedStatus = album.listened ? '✓ Escuchado' : '○ No escuchado';
        const listenedClass = album.listened ? 'listened' : 'not-listened';

        card.innerHTML = `
            <div class="top-album-rank">${rank}</div>
            <div class="top-album-image">
                <img src="${album.image}" alt="${album.name}" onerror="this.src='https://via.placeholder.com/100?text=No+Image'">
            </div>
            <div class="top-album-info">
                <div class="top-album-name">${album.name}</div>
                <div class="top-album-artist">${album.artist}</div>
                <div class="top-album-meta">
                    <span class="top-album-year">${album.year}</span>
                    <span class="top-album-country">${album.country}</span>
                    <span class="top-album-genre">${album.main_genre}</span>
                </div>
                <div class="top-album-subgenre">${album.genre}</div>
                <div class="listened-status ${listenedClass}">${listenedStatus}</div>
            </div>
            <div class="top-album-rating">
                <span class="top-rating-badge">${album.rate.toFixed(4)}</span>
                <span class="top-rating-stars">${stars}</span>
                ${album.avg_rate !== undefined && album.avg_rate !== null ? `<span class="top-rating-count">Promedio: ${album.avg_rate.toFixed(4)}</span>` : ''}
                ${album.like_percentage !== undefined ? `<span class="top-rating-count">${album.like_percentage.toFixed(0)}% me gustan</span>` : ''}
            </div>
        `;

        // Add click handler for listened status
        const listenedStatusEl = card.querySelector('.listened-status');
        if (listenedStatusEl) {
            listenedStatusEl.addEventListener('click', (e) => {
                e.stopPropagation();
                if (!this.isAdmin) {
                    alert('Debes iniciar sesión para realizar esta acción');
                    return;
                }
                this.toggleRatingsListenedStatus(this.ratingsData.indexOf(album));
            });
        }

        return card;
    }

    // Ratings Methods
    async renderRatings() {
        const searchTerm = document.getElementById('search-ratings').value.toLowerCase();
        const genreFilter = document.getElementById('filter-genre').value;
        const countryFilter = document.getElementById('filter-country').value;
        const decadeFilter = document.getElementById('filter-decade').value;
        const sortBy = document.getElementById('sort-ratings').value;

        console.log('Filtros:', { searchTerm, genreFilter, countryFilter, decadeFilter, sortBy });
        console.log('Total datos:', this.ratingsData.length);

        let filtered = this.ratingsData.filter(album => {
            const matchesSearch = album.name.toLowerCase().includes(searchTerm) ||
                               album.artist.toLowerCase().includes(searchTerm);
            const matchesGenre = !genreFilter || album.main_genre === genreFilter;
            const matchesCountry = !countryFilter || album.country === countryFilter;

            // Filtro de década
            let matchesDecade = true;
            if (decadeFilter) {
                const year = parseInt(album.year);
                const decadeStart = parseInt(decadeFilter.substring(0, 3) + '0');
                const decadeEnd = decadeStart + 9;
                matchesDecade = year >= decadeStart && year <= decadeEnd;
            }

            return matchesSearch && matchesGenre && matchesCountry && matchesDecade;
        });

        console.log('Álbumes filtrados:', filtered.length);

        // Ordenar
        if (sortBy === 'rating') {
            filtered.sort((a, b) => {
                if (b.rate !== a.rate) {
                    return b.rate - a.rate;
                }
                // Secondary criteria: like_percentage
                return (b.like_percentage || 0) - (a.like_percentage || 0);
            });
        } else if (sortBy === 'year') {
            filtered.sort((a, b) => parseInt(b.year) - parseInt(a.year));
        } else if (sortBy === 'name') {
            filtered.sort((a, b) => a.name.localeCompare(b.name));
        }

        // Calcular estadísticas de listened
        const listenedCount = this.ratingsData.filter(album => album.listened).length;
        const totalCount = this.ratingsData.length;

        document.getElementById('listened-albums').textContent = listenedCount;
        document.getElementById('total-albums').textContent = totalCount;

        // Llenar filtros
        this.populateGenreFilter('filter-genre', this.ratingsData);
        this.populateCountryFilter('filter-country', this.ratingsData);

        const container = document.getElementById('ratings-list');
        container.innerHTML = '';

        filtered.forEach((album, index) => {
            const card = this.createTopAlbumCard(album, index + 1);
            container.appendChild(card);
        });
    }

    // Rotation Methods
    async toggleListenedStatus(albumIndex) {
        const album = this.rotationData[albumIndex];
        if (!album) return;

        // Toggle the listened status
        album.listened = !album.listened;

        console.log(`🔄 Cambiando estado de escucha para "${album.name}": ${album.listened ? 'Escuchado' : 'No escuchado'}`);

        // Save to localStorage and file for persistence
        await this.saveDataToStorage();

        // Re-render rotation to update UI
        this.renderRotation();
    }

    async toggleRatingsListenedStatus(albumIndex) {
        const album = this.ratingsData[albumIndex];
        if (!album) return;

        // Toggle the listened status
        album.listened = !album.listened;

        console.log(`🔄 Cambiando estado de escucha para "${album.name}" (ratings): ${album.listened ? 'Escuchado' : 'No escuchado'}`);

        // Save to localStorage and file for persistence
        await this.saveDataToStorage();

        // Re-render ratings to update UI
        await this.renderRatings();
    }

    async resetAllListenedStatus() {
        if (!confirm('¿Estás seguro de que quieres reiniciar todos los estados de escuchado a "No escuchado"? Esta acción no se puede deshacer.')) {
            return;
        }

        if (!confirm('Segunda confirmación: ¿Realmente quieres reiniciar todos los estados?')) {
            return;
        }

        console.log('🔄 Reiniciando todos los estados de escuchado a false');

        // Reset all listened status to false
        this.ratingsData.forEach(album => {
            album.listened = false;
        });

        // Save to localStorage and file for persistence
        await this.saveDataToStorage();

        // Re-render ratings to update UI
        await this.renderRatings();

        console.log('✅ Todos los estados de escuchado han sido reiniciados');
    }

    async resetRotationListenedStatus() {
        if (!confirm('¿Estás seguro de que quieres reiniciar todos los estados de escuchado a "No escuchado" en rotación? Esta acción no se puede deshacer.')) {
            return;
        }

        if (!confirm('Segunda confirmación: ¿Realmente quieres reiniciar todos los estados de rotación?')) {
            return;
        }

        console.log('🔄 Reiniciando todos los estados de escuchado de rotación a false');

        // Reset all listened status to false in rotation
        this.rotationData.forEach(album => {
            album.listened = false;
        });

        // Save to localStorage and file for persistence
        await this.saveDataToStorage();

        // Re-render rotation to update UI
        this.renderRotation();

        console.log('✅ Todos los estados de escuchado de rotación han sido reiniciados');
    }

    async saveDataToStorage() {
        // Save to localStorage (fallback)
        localStorage.setItem('rotationData', JSON.stringify(this.rotationData));
        localStorage.setItem('ratingsData', JSON.stringify(this.ratingsData));
        localStorage.setItem('vinylData', JSON.stringify(this.vinylData));
        localStorage.setItem('goalsData', JSON.stringify(this.goalsData));

        // Try to save via API
        try {
            const rotationResponse = await fetch(`${this.apiBaseUrl}/rotation`, {
                method: 'PUT',
                headers: this.getAuthHeaders(),
                body: JSON.stringify(this.rotationData)
            });

            const ratingsResponse = await fetch(`${this.apiBaseUrl}/ratings`, {
                method: 'PUT',
                headers: this.getAuthHeaders(),
                body: JSON.stringify(this.ratingsData)
            });

            if (rotationResponse.ok && ratingsResponse.ok) {
                console.log('✅ Datos guardados via API exitosamente');
            } else {
                console.error('❌ Error en respuesta de API:', {
                    rotation: rotationResponse.status,
                    ratings: ratingsResponse.status
                });
            }
        } catch (error) {
            console.error('❌ Error guardando via API:', error);
        }
    }

    async updatePendingListens(albumIndex, change) {
        const album = this.rotationData[albumIndex];
        if (!album) return;

        console.log(`🔄 Actualizando escuchas para "${album.name}": ${album.pending_listens} → ${Math.max(0, album.pending_listens + change)}`);

        // Update pending_listens (ensure it doesn't go below 0)
        album.pending_listens = Math.max(0, album.pending_listens + change);
        
        // Recalculate remaining (pending_listens * minutes)
        album.remaining = album.pending_listens * album.minutes;

        console.log(`📊 Nuevos valores: pending=${album.pending_listens}, remaining=${album.remaining}`);

        // Save to localStorage and file for persistence
        await this.saveDataToStorage();

        // Re-render rotation to update UI and statistics
        this.renderRotation();
    }

    async renderRotation() {
        // Update goals display
        this.updateGoalsDisplay();

        const now = new Date();
        const endYear = new Date(now.getFullYear(), 11, 31);
        const diffdate = endYear - now;

        const searchTerm = document.getElementById('search-rotation').value.toLowerCase();
        const genreFilter = document.getElementById('filter-rotation-genre').value;
        const listenedFilter = document.getElementById('filter-rotation-listened').value;
        const pendingFilter = document.getElementById('filter-rotation-pending').value;

        let filtered = this.rotationData.filter(album => {
            const name = album.name || '';
            const artist = album.artist || '';
            const matchesSearch = name.toLowerCase().includes(searchTerm) ||
                               artist.toLowerCase().includes(searchTerm);
            const genre = album.main_genre || '';
            const matchesGenre = !genreFilter || genre === genreFilter;
            const matchesListened = !listenedFilter ||
                                   (listenedFilter === 'listened' && album.listened) ||
                                   (listenedFilter === 'not-listened' && !album.listened);
            const pendingListens = album.pending_listens || 0;
            const matchesPending = !pendingFilter ||
                                   (pendingFilter === '1' && pendingListens === 1) ||
                                   (pendingFilter === 'more' && pendingListens > 1);
            return matchesSearch && matchesGenre && matchesListened && matchesPending;
        });

        // Calcular estadísticas
        const totalPending = filtered.reduce((sum, album) => sum + (album.pending_listens || 0), 0);
        const totalMinutes = filtered.reduce((sum, album) => sum + (album.remaining || 0), 0);
        const totalHours = Math.floor(totalMinutes / 60);
        const totalMins = totalMinutes % 60;
        const days = ((totalMinutes / 60) / 24).toFixed(4); // Conversión de horas a días
        const remainingWeeks = (diffdate / (1000 * 60 * 60 * 24)) / 7
        const remainingWeeksAbs = Math.trunc(remainingWeeks)
        const remainingDays = remainingWeeksAbs * 5
        const weeksCalculation = (days / remainingWeeksAbs).toFixed(4)
        const daysCalculation = (weeksCalculation / 5).toFixed(4)

        // Calcular álbumes escuchados y total (solo de rotación)
        const listenedAlbums = this.rotationData.filter(album => album.listened).length;
        const totalAlbums = this.rotationData.length;

        document.getElementById('pending-albums').textContent = totalPending;
        document.getElementById('total-time').textContent = `${totalHours}h ${totalMins}m`;
        document.getElementById('weeks-remaining').textContent = `${days} días`;
        document.getElementById('remaining-days').textContent = `${remainingDays} días`;
        document.getElementById('remaining-weeks').textContent = `${remainingWeeksAbs} semanas`;
        document.getElementById('days-calculation').textContent = `${daysCalculation}`;
        document.getElementById('weeks-calculation').textContent = `${weeksCalculation}`;
        document.getElementById('total-listened').textContent = listenedAlbums;
        document.getElementById('total-albums-dashboard').textContent = totalAlbums;

        // Llenar filtro de géneros
        this.populateGenreFilter('filter-rotation-genre', this.rotationData, 'main_genre');

        const container = document.getElementById('rotation-list');
        container.innerHTML = '';

        filtered.forEach((album, index) => {
            const card = this.createRotationCard(album, index + 1);
            container.appendChild(card);
        });
    }

    // Vinyl Methods
    renderVinyl() {
        const searchTerm = document.getElementById('search-vinyl').value.toLowerCase();
        const genreFilter = document.getElementById('filter-vinyl-genre').value;
        const countryFilter = document.getElementById('filter-vinyl-country').value;
        const decadeFilter = document.getElementById('filter-vinyl-decade').value;
        const colorFilter = document.getElementById('filter-vinyl-color').value;
        const statusFilter = document.getElementById('filter-vinyl-status').value;
        const sortBy = document.getElementById('sort-vinyl').value;

        let filtered = this.vinylData.filter(album => {
            const name = album.name || '';
            const artist = album.artist || '';
            const matchesSearch = name.toLowerCase().includes(searchTerm) ||
                               artist.toLowerCase().includes(searchTerm);
            const matchesGenre = !genreFilter || album.main_genre === genreFilter;
            const matchesCountry = !countryFilter || album.country === countryFilter;
            const matchesColor = !colorFilter ||
                                (colorFilter === 'Negro' && album.vinyl_color === 'Negro') ||
                                (colorFilter === 'Color' && album.vinyl_color !== 'Negro');
            const matchesStatus = !statusFilter || album.status === statusFilter;

            let matchesDecade = true;
            if (decadeFilter) {
                const year = parseInt(album.year);
                const decadeStart = parseInt(decadeFilter.substring(0, 3) + '0');
                const decadeEnd = decadeStart + 9;
                matchesDecade = year >= decadeStart && year <= decadeEnd;
            }

            return matchesSearch && matchesGenre && matchesCountry && matchesColor && matchesStatus && matchesDecade;
        });

        if (sortBy === 'rating') {
            filtered.sort((a, b) => (b.rate || 0) - (a.rate || 0));
        } else if (sortBy === 'year') {
            filtered.sort((a, b) => (parseInt(a.year) || 0) - (parseInt(b.year) || 0));
        } else if (sortBy === 'name') {
            filtered.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
        }

        this.populateGenreFilter('filter-vinyl-genre', this.vinylData);
        this.populateCountryFilter('filter-vinyl-country', this.vinylData);
        this.renderVinylStats();

        const container = document.getElementById('vinyl-list');
        container.innerHTML = '';

        filtered.forEach((album, index) => {
            const card = this.createVinylCard(album, index + 1);
            container.appendChild(card);
        });
    }

    renderVinylStats() {
        // Por color
        const blackCount = this.vinylData.filter(album => album.vinyl_color === 'Negro').length;
        const colorCount = this.vinylData.filter(album => album.vinyl_color !== 'Negro').length;

        document.getElementById('vinyl-black-count').textContent = blackCount;
        document.getElementById('vinyl-color-count').textContent = colorCount;

        // Por estado
        const interiorizadoCount = this.vinylData.filter(album => album.status === 'Interiorizado').length;
        const enEscuchaCount = this.vinylData.filter(album => album.status === 'En escucha').length;
        const escuchadoMuchoCount = this.vinylData.filter(album => album.status === 'Escuchado hace mucho tiempo').length;
        const escuchado1Count = this.vinylData.filter(album => album.status === 'Escuchado 1 vez').length;
        const noEscuchadoCount = this.vinylData.filter(album => album.status === 'No Escuchado').length;

        document.getElementById('vinyl-status-interiorizado').textContent = interiorizadoCount;
        document.getElementById('vinyl-status-en-escucha').textContent = enEscuchaCount;
        document.getElementById('vinyl-status-escuchado-mucho').textContent = escuchadoMuchoCount;
        document.getElementById('vinyl-status-escuchado-1').textContent = escuchado1Count;
        document.getElementById('vinyl-status-no-escuchado').textContent = noEscuchadoCount;
    }

    getStatusClass(status) {
        if (!status) return '';
        if (status === 'Interiorizado' || status.includes('Interiorizado')) return 'status-interiorizado';
        if (status === 'En escucha' || status.includes('En escucha')) return 'status-en-escucha';
        if (status.includes('hace mucho tiempo')) return 'status-escuchado';
        if (status.includes('1 vez')) return 'status-escuchado-1-vez';
        if (status.includes('No Escuchado')) return 'status-no-escuchado';
        return '';
    }

    // Helper Methods
    populateGenreFilter(elementId, data, genreField = 'main_genre') {
        const select = document.getElementById(elementId);
        const currentValue = select.value;
        const genres = [...new Set(data.map(album => album[genreField]))].filter(Boolean).sort();

        select.innerHTML = '<option value="">Todos los géneros</option>';
        genres.forEach(genre => {
            const option = document.createElement('option');
            option.value = genre;
            option.textContent = genre;
            select.appendChild(option);
        });

        select.value = currentValue;
    }

    populateCountryFilter(elementId, data) {
        const select = document.getElementById(elementId);
        const currentValue = select.value;
        const countries = [...new Set(data.map(album => album.country))].filter(Boolean).sort();

        select.innerHTML = '<option value="">Todos los países</option>';
        countries.forEach(country => {
            const option = document.createElement('option');
            option.value = country;
            option.textContent = country;
            select.appendChild(option);
        });

        select.value = currentValue;
    }

    createAlbumCard(album, rank = null) {
        const card = document.createElement('div');
        card.className = 'album-card';
        card.dataset.albumIndex = this.ratingsData.indexOf(album);
        card.addEventListener('click', () => this.showAlbumDetails(album));

        const stars = this.getAlbumStarRating(album.rate);

        card.innerHTML = `
            <div class="album-image">
                <img src="${album.image}" alt="${album.name}" onerror="this.src='https://via.placeholder.com/300?text=No+Image'">
            </div>
            <div class="album-header">
                <div>
                    <div class="album-title">${rank ? `${rank}. ` : ''}${album.name}</div>
                    <div class="album-artist">${album.artist}</div>
                </div>
                <span class="album-year">${album.year}</span>
            </div>
            <div class="album-genre">${album.main_genre}</div>
            <div class="album-rating">
                <span class="rating-badge">${album.rate.toFixed(4)}</span>
                <span class="rating-stars">${stars}</span>
            </div>
            ${album.avg_rate !== undefined && album.avg_rate !== null ? `<div class="album-duration">Promedio: ${album.avg_rate.toFixed(4)}</div>` : ''}
            ${album.like_percentage ? `<div class="album-duration">${album.like_percentage.toFixed(0)}% canciones que gustan</div>` : ''}
        `;

        return card;
    }

    createRotationCard(album, rank) {
        const card = document.createElement('div');
        card.className = 'top-album-card';
        
        const name = album.name;
        const artist = album.artist;
        const year = album.year;
        const country = album.country;
        const mainGenre = album.main_genre;
        const genre = album.genre;
        const pending = album.pending_listens;
        const remaining = album.remaining;
        const minutes = album.minutes;
        const image = album.image || '';
        const listened = album.listened || false;

        const hours = Math.floor(minutes / 60);
        const mins = minutes % 60;

        const isReadyToRate = pending === 0;
        const isOnePending = pending === 1;

        card.innerHTML = `
            <div class="top-album-rank">${rank}</div>
            <div class="top-album-image">
                <img src="${image}" alt="${name}" onerror="this.src='https://via.placeholder.com/100?text=No+Image'">
            </div>
            <div class="top-album-info">
                <div class="top-album-name">${name}</div>
                <div class="top-album-artist">${artist}</div>
                <div class="top-album-meta">
                    <span class="top-album-year">${year}</span>
                    <span class="top-album-country">${country}</span>
                    <span class="top-album-genre">${mainGenre}</span>
                </div>
                <div class="top-album-subgenre">${genre}</div>
                <div class="listened-status-container">
                    <span class="listened-status ${listened ? 'listened' : 'not-listened'}" data-album-index="${this.rotationData.indexOf(album)}">
                        ${listened ? '✓ Escuchado' : '○ No escuchado'}
                    </span>
                </div>
            </div>
            <div class="top-album-rating">
                <span class="top-rating-badge">${hours}h ${mins}m</span>
                ${isOnePending ? `
                    <span class="top-rating-count one-pending">Pendientes: ${pending}</span>
                ` : `
                    <span class="top-rating-count">Pendientes: ${pending}</span>
                `}
                <span class="top-rating-count">Restantes: ${remaining}m</span>
                <div class="rotation-controls">
                    <button class="rotation-btn decrease" data-album-index="${this.rotationData.indexOf(album)}">-</button>
                    <button class="rotation-btn increase" data-album-index="${this.rotationData.indexOf(album)}">+</button>
                </div>
                ${isReadyToRate ? `
                    <button class="rate-album-btn" data-album-index="${this.rotationData.indexOf(album)}">Calificar Álbum</button>
                ` : ''}
            </div>
        `;

        // Add click handler for the card (for showing details)
        card.addEventListener('click', (e) => {
            if (!e.target.classList.contains('rotation-btn') && 
                !e.target.classList.contains('rate-album-btn') && 
                !e.target.classList.contains('listened-status')) {
                this.showAlbumDetails(album);
            }
        });

        // Add click handlers for the buttons
        const decreaseBtn = card.querySelector('.decrease');
        const increaseBtn = card.querySelector('.increase');
        const rateBtn = card.querySelector('.rate-album-btn');
        const listenedStatus = card.querySelector('.listened-status');

        if (decreaseBtn) {
            decreaseBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                if (!this.isAdmin) {
                    alert('Debes iniciar sesión para realizar esta acción');
                    return;
                }
                this.updatePendingListens(this.rotationData.indexOf(album), -1);
            });
        }

        if (increaseBtn) {
            increaseBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                if (!this.isAdmin) {
                    alert('Debes iniciar sesión para realizar esta acción');
                    return;
                }
                this.updatePendingListens(this.rotationData.indexOf(album), 1);
            });
        }

        if (rateBtn) {
            rateBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.openRatingModal(album);
            });
        }

        if (listenedStatus) {
            listenedStatus.addEventListener('click', (e) => {
                e.stopPropagation();
                if (!this.isAdmin) {
                    alert('Debes iniciar sesión para realizar esta acción');
                    return;
                }
                this.toggleListenedStatus(this.rotationData.indexOf(album));
            });
        }

        return card;
    }

    createVinylCard(album, rank) {
        const card = document.createElement('div');
        card.className = 'top-album-card';
        card.addEventListener('click', () => this.showAlbumDetails(album));

        const statusClass = this.getStatusClass(album.status);
        const stars = album.rate ? this.getAlbumStarRating(album.rate) : '';
        const imageSrc = album.image || 'https://via.placeholder.com/100?text=No+Image';

        card.innerHTML = `
            <div class="top-album-rank">${rank}</div>
            <div class="top-album-image">
                <img src="${imageSrc}" alt="${album.name}" onerror="this.src='https://via.placeholder.com/100?text=No+Image'">
            </div>
            <div class="top-album-info">
                <div class="top-album-name">${album.name}</div>
                <div class="top-album-artist">${album.artist}</div>
                <div class="top-album-meta">
                    <span class="top-album-year">${album.year || ''}</span>
                    ${album.country ? `<span class="top-album-country">${album.country}</span>` : ''}
                    ${album.main_genre ? `<span class="top-album-genre">${album.main_genre}</span>` : ''}
                </div>
                ${album.genre ? `<div class="top-album-subgenre">${album.genre}</div>` : ''}
            </div>
            <div class="top-album-rating">
                ${album.rate ? `<span class="top-rating-badge">${album.rate.toFixed(4)}</span>` : ''}
                ${stars ? `<span class="top-rating-stars">${stars}</span>` : ''}
                ${album.avg_rate !== undefined && album.avg_rate !== null ? `<span class="top-rating-count">Promedio: ${album.avg_rate.toFixed(4)}</span>` : ''}
                ${album.status ? `<span class="status-badge ${statusClass}">${album.status}</span>` : ''}
                ${album.vinyl_color ? `
                    <span class="top-rating-count vinyl-color-label">
                        <span class="color-dot" style="background: ${this.getVinylColor(album.vinyl_color)}"></span>
                        ${album.vinyl_color}
                    </span>
                ` : ''}
            </div>
        `;

        return card;
    }

    showAlbumDetails(album) {
        const modal = document.getElementById('album-modal');
        const modalContent = document.getElementById('modal-content');

        const stars = this.getAlbumStarRating(album.rate);

        // Check if this is a vinyl album
        const isVinyl = this.vinylData.includes(album);

        // Check if this is a rated album (has songs)
        const isRatedAlbum = this.ratingsData.includes(album) && album.songs && album.songs.length > 0;

        // Ensure songs have fixed numbers
        if (album.songs && album.songs.length > 0) {
            album.songs.forEach((song, index) => {
                if (song.number === undefined) {
                    song.number = index + 1;
                }
            });
        }

        let songsHTML = '';
        if (album.songs && album.songs.length > 0) {
            songsHTML = `
                <div class="songs-section">
                    <h3>Canciones</h3>
                    <div class="songs-list">
                        ${album.songs.map((song, index) => {
                            const songStars = this.getStarRating(song.rate);
                            if (isRatedAlbum) {
                                return `
                                    <div class="song-item editable-song">
                                        <span class="song-number">${song.number}</span>
                                        <span class="song-name">${song.name}</span>
                                        <span class="song-rating-controls">
                                            <span class="rating-badge-small">${song.rate.toFixed(3)}</span>
                                            <span class="rating-stars-small">${songStars}</span>
                                            <button class="edit-song-rating-btn" data-song-index="${index}" data-album-index="${this.ratingsData.indexOf(album)}">✏️</button>
                                        </span>
                                    </div>
                                `;
                            } else {
                                return `
                                    <div class="song-item">
                                        <span class="song-number">${song.number}</span>
                                        <span class="song-name">${song.name}</span>
                                        <span class="song-rating">
                                            <span class="rating-badge-small">${song.rate.toFixed(3)}</span>
                                            <span class="rating-stars-small">${songStars}</span>
                                        </span>
                                    </div>
                                `;
                            }
                        }).join('')}
                    </div>
                </div>
            `;
        }

        // Vinyl status selector HTML
        let vinylStatusHTML = '';
        if (isVinyl) {
            const availableStatuses = [
                'Interiorizado',
                'En escucha',
                'Escuchado hace mucho tiempo',
                'Escuchado 1 vez',
                'No Escuchado'
            ];
            
            vinylStatusHTML = `
                <div class="vinyl-status-section">
                    <h3>Cambiar Estado del Vinilo</h3>
                    <div class="status-selector">
                        <select id="vinyl-status-select" class="status-select">
                            ${availableStatuses.map(status => `
                                <option value="${status}" ${album.status === status ? 'selected' : ''}>${status}</option>
                            `).join('')}
                        </select>
                        <button id="change-vinyl-status-btn" class="change-status-button">Cambiar Estado</button>
                    </div>
                </div>
            `;
        }

        modalContent.innerHTML = `
            <button class="close-modal" onclick="document.getElementById('album-modal').classList.remove('active')">&times;</button>
            <div class="modal-header">
                <div class="modal-image">
                    <img src="${album.image}" alt="${album.name}" onerror="this.src='https://via.placeholder.com/400?text=No+Image'">
                </div>
                <div class="modal-info">
                    <h2 class="modal-title">${album.name}</h2>
                    <p class="modal-artist">${album.artist}</p>
                    <div class="modal-meta">
                        <span class="modal-year">${album.year}</span>
                        <span class="modal-country">${album.country}</span>
                    </div>
                    <div class="modal-genres">
                        <span class="genre-tag main">${album.main_genre}</span>
                        <span class="genre-tag sub">${album.genre}</span>
                    </div>
                    ${album.rate ? `
                    <div class="modal-rating">
                        <span class="rating-badge-large">${Number(album.rate).toFixed(4)}</span>
                        <span class="rating-stars-large">${stars}</span>
                        ${album.avg_rate !== undefined ? `<span class="rating-avg">Avg: ${Number(album.avg_rate).toFixed(4)}</span>` : ''}
                    </div>
                    ` : ''}
                    <div class="modal-stats">
                        ${album.duration !== undefined ? `
                        <div class="stat-item">
                            <span class="stat-label">Duración</span>
                            <span class="stat-value">${album.duration} min</span>
                        </div>
                        ` : ''}
                        ${album.like_percentage !== undefined ? `
                        <div class="stat-item">
                            <span class="stat-label">Me gustan</span>
                            <span class="stat-value">${album.like_percentage.toFixed(0)}%</span>
                        </div>
                        ` : ''}
                        ${album.songs ? `
                        <div class="stat-item">
                            <span class="stat-label">Canciones</span>
                            <span class="stat-value">${album.songs.length}</span>
                        </div>
                        ` : ''}
                        ${album.vinyl_color ? `
                        <div class="stat-item">
                            <span class="stat-label">Color</span>
                            <span class="stat-value">${album.vinyl_color}</span>
                        </div>
                        ` : ''}
                        ${album.status ? `
                        <div class="stat-item">
                            <span class="stat-label">Estado</span>
                            <span class="stat-value">${album.status}</span>
                        </div>
                        ` : ''}
                    </div>
                </div>
            </div>
            ${vinylStatusHTML}
            ${songsHTML}
        `;

        // Add event listener for vinyl status change if it's a vinyl
        if (isVinyl) {
            const changeStatusBtn = document.getElementById('change-vinyl-status-btn');
            const statusSelect = document.getElementById('vinyl-status-select');
            
            if (changeStatusBtn && statusSelect) {
                changeStatusBtn.addEventListener('click', () => {
                    if (!this.isAdmin) {
                        alert('Debes iniciar sesión para realizar esta acción');
                        return;
                    }
                    this.changeVinylStatus(album, statusSelect.value);
                });
            }
        }

        // Add event listeners for edit song rating buttons if it's a rated album
        if (isRatedAlbum) {
            const editSongBtns = modalContent.querySelectorAll('.edit-song-rating-btn');
            editSongBtns.forEach(btn => {
                btn.addEventListener('click', (e) => {
                    const songIndex = parseInt(e.target.dataset.songIndex);
                    const albumIndex = parseInt(e.target.dataset.albumIndex);
                    this.openEditSongRatingModal(album, songIndex, albumIndex);
                });
            });
        }

        modal.classList.add('active');
    }

    async changeVinylStatus(album, newStatus) {
        if (!confirm(`¿Estás seguro de que quieres cambiar el estado de "${album.name}" a "${newStatus}"?`)) {
            return;
        }

        // Update the album status
        album.status = newStatus;

        console.log(`🔄 Cambiando estado de vinilo "${album.name}" a "${newStatus}"`);

        // Save vinyl data to server
        await this.saveVinylData();

        // Re-render vinyl section to update UI
        this.renderVinyl();

        // Update the modal to show the new status - find the status stat item
        const statItems = document.querySelectorAll('.modal-stats .stat-item');
        for (const statItem of statItems) {
            const label = statItem.querySelector('.stat-label');
            if (label && label.textContent === 'Estado') {
                const value = statItem.querySelector('.stat-value');
                if (value) {
                    value.textContent = newStatus;
                }
                break;
            }
        }

        console.log('✅ Estado de vinilo actualizado exitosamente');
    }

    async saveVinylData() {
        // Save to localStorage (fallback)
        localStorage.setItem('vinylData', JSON.stringify(this.vinylData));

        // Try to save via API
        try {
            const response = await fetch(`${this.apiBaseUrl}/vinyl`, {
                method: 'PUT',
                headers: this.getAuthHeaders(),
                body: JSON.stringify(this.vinylData)
            });

            if (response.ok) {
                console.log('✅ Datos de vinilos guardados via API exitosamente');
            } else {
                console.error('❌ Error en respuesta de API:', response.status);
            }
        } catch (error) {
            console.error('❌ Error guardando datos de vinilos via API:', error);
        }
    }

    getStarRating(rating) {
        const fullStars = Math.floor(rating);
        const decimal = rating % 1;
        const timestamp = Date.now();
        let starsHTML = '';
        let starCount = 0;

        // Caso especial para 5.25 y 5.5 (estrella especial naranja)
        if (rating >= 5.25 && rating < 5.5) {
            // 5 estrellas completas normales
            for (let i = 0; i < 5; i++) {
                starsHTML += `<img src="images/star-full.svg?v=${timestamp}" class="star-icon" alt="★">`;
                starCount++;
            }
            // Media estrella naranja con resplandor para la sexta
            starsHTML += `<img src="images/star-half-orange.svg?v=${timestamp}" class="star-icon" alt="★">`;
            starCount++;
        } else if (rating >= 5.5) {
            // 5 estrellas completas normales
            for (let i = 0; i < 5; i++) {
                starsHTML += `<img src="images/star-full.svg?v=${timestamp}" class="star-icon" alt="★">`;
                starCount++;
            }
            // Estrella completa naranja con resplandor para la sexta
            starsHTML += `<img src="images/star-full-orange.svg?v=${timestamp}" class="star-icon" alt="★">`;
            starCount++;
        } else {
            // Caso normal para ratings menores a 5.25
            // Estrellas completas
            for (let i = 0; i < fullStars; i++) {
                starsHTML += `<img src="images/star-full.svg?v=${timestamp}" class="star-icon" alt="★">`;
                starCount++;
            }

            // Estrella parcial (si corresponde)
            if (decimal >= 0.75) {
                starsHTML += `<img src="images/star-three-quarters.svg?v=${timestamp}" class="star-icon" alt="¾">`;
                starCount++;
            } else if (decimal >= 0.5) {
                starsHTML += `<img src="images/star-half.svg?v=${timestamp}" class="star-icon" alt="½">`;
                starCount++;
            } else if (decimal >= 0.25) {
                starsHTML += `<img src="images/star-quarter.svg?v=${timestamp}" class="star-icon" alt="¼">`;
                starCount++;
            }

            // Completar hasta 6 estrellas con estrellas vacías
            const remainingStars = 6 - starCount;
            for (let i = 0; i < remainingStars; i++) {
                // Si es la sexta estrella (la última), usar gris claro
                // Si son las estrellas 1-5, usar gris oscuro
                if (starCount + i === 5) {
                    starsHTML += `<img src="images/star-empty-light.svg?v=${timestamp}" class="star-icon" alt="☆">`;
                } else {
                    starsHTML += `<img src="images/star-empty.svg?v=${timestamp}" class="star-icon" alt="☆">`;
                }
            }
        }

        return starsHTML;
    }

    getAlbumStarRating(rating) {
        const fullStars = Math.floor(rating);
        const decimal = rating % 1;
        const timestamp = Date.now();
        let starsHTML = '';

        // Estrellas completas
        for (let i = 0; i < fullStars; i++) {
            starsHTML += `<img src="images/star-full.svg?v=${timestamp}" class="star-icon" alt="★">`;
        }

        // Estrella parcial (si corresponde)
        if (decimal >= 0.75) {
            starsHTML += `<img src="images/star-three-quarters.svg?v=${timestamp}" class="star-icon" alt="¾">`;
        } else if (decimal >= 0.5) {
            starsHTML += `<img src="images/star-half.svg?v=${timestamp}" class="star-icon" alt="½">`;
        } else if (decimal >= 0.25) {
            starsHTML += `<img src="images/star-quarter.svg?v=${timestamp}" class="star-icon" alt="¼">`;
        }

        // Completar hasta 5 estrellas con estrellas vacías oscuras
        const totalStars = Math.ceil(rating);
        const remainingStars = 5 - totalStars;
        for (let i = 0; i < remainingStars; i++) {
            starsHTML += `<img src="images/star-empty.svg?v=${timestamp}" class="star-icon" alt="☆">`;
        }

        return starsHTML;
    }

    getVinylColor(colorName) {
        const colorMap = {
            'Negro': '#333333',
            'Blanco': '#ffffff',
            'Rojo': '#e53935',
            'Azul': '#1e88e5',
            'Verde': '#43a047',
            'Amarillo': '#fdd835',
            'Naranja': '#fb8c00',
            'Morado': '#8e24aa',
            'Rosa': '#e91e63',
            'Transparente': 'rgba(255,255,255,0.3)',
            'Dorado': '#ffc107',
            'Gris': '#757575',
        };
        
        return colorMap[colorName] || '#667eea';
    }

    // Rating Modal Methods
    openRatingModal(album) {
        const modal = document.getElementById('rating-modal');
        const modalContent = document.getElementById('rating-modal-content');
        
        // Store current album being rated
        this.currentRatingAlbum = album;
        this.currentSongs = [];

        modalContent.innerHTML = `
            <button class="close-modal" onclick="document.getElementById('rating-modal').classList.remove('active')">&times;</button>
            <div class="modal-header">
                <div class="modal-image">
                    <img src="${album.image}" alt="${album.name}" onerror="this.src='https://via.placeholder.com/400?text=No+Image'">
                </div>
                <div class="modal-info">
                    <h2 class="modal-title">${album.name}</h2>
                    <p class="modal-artist">${album.artist}</p>
                    <div class="modal-meta">
                        <span class="modal-year">${album.year}</span>
                        <span class="modal-country">${album.country}</span>
                    </div>
                    <div class="modal-genres">
                        <span class="genre-tag main">${album.main_genre}</span>
                        <span class="genre-tag sub">${album.genre}</span>
                    </div>
                    <div class="album-rating-display">
                        <div class="rating-summary">
                            <h3>Calificación del Álbum</h3>
                            <div class="current-album-rating" id="current-album-rating">0.0000</div>
                            <div class="rating-stars" id="album-rating-stars"></div>
                        </div>
                    </div>
                </div>
            </div>
            <div class="rating-songs-section">
                <div class="add-song-form">
                    <h3>Agregar Canción</h3>
                    <div class="song-input-row">
                        <input type="text" id="song-name-input" placeholder="Nombre de la canción">
                        <input type="number" id="song-min-rating" placeholder="Min (0-6)" min="0" max="6" step="0.25">
                        <input type="number" id="song-max-rating" placeholder="Max (0-6)" min="0" max="6" step="0.25">
                        <button id="add-song-btn" class="add-song-button">Agregar</button>
                    </div>
                </div>
                <div class="songs-list-container">
                    <h3>Canciones Agregadas</h3>
                    <div id="rating-songs-list" class="rating-songs-list"></div>
                </div>
            </div>
            <div class="rating-actions">
                <button id="complete-rating-btn" class="complete-rating-button" disabled>Calificar Álbum</button>
            </div>
        `;

        // Setup event listeners
        const addSongBtn = document.getElementById('add-song-btn');
        const completeRatingBtn = document.getElementById('complete-rating-btn');
        
        if (addSongBtn) {
            addSongBtn.addEventListener('click', () => this.addSong());
        }
        
        if (completeRatingBtn) {
            completeRatingBtn.addEventListener('click', () => this.confirmRating());
        }

        modal.classList.add('active');
    }

    addSong() {
        const nameInput = document.getElementById('song-name-input');
        const minRatingInput = document.getElementById('song-min-rating');
        const maxRatingInput = document.getElementById('song-max-rating');

        const name = nameInput.value.trim();
        const minRating = parseFloat(minRatingInput.value);
        const maxRating = parseFloat(maxRatingInput.value);

        if (!name) {
            alert('Por favor ingresa el nombre de la canción');
            return;
        }

        if (isNaN(minRating) || isNaN(maxRating)) {
            alert('Por favor ingresa las calificaciones mínima y máxima');
            return;
        }

        if (minRating < 0 || minRating > 6 || maxRating < 0 || maxRating > 6) {
            alert('Las calificaciones deben estar entre 0 y 6');
            return;
        }

        if (minRating > maxRating) {
            alert('La calificación mínima no puede ser mayor que la máxima');
            return;
        }

        // Calculate average rating
        const avgRating = (minRating + maxRating) / 2;

        const song = {
            name: name,
            min_rating: minRating,
            max_rating: maxRating,
            rate: avgRating
        };

        this.currentSongs.push(song);

        // Clear inputs
        nameInput.value = '';
        minRatingInput.value = '';
        maxRatingInput.value = '';

        // Update songs list and album rating
        this.updateSongsList();
        this.updateAlbumRating();
    }

    updateSongsList() {
        const container = document.getElementById('rating-songs-list');
        container.innerHTML = '';

        this.currentSongs.forEach((song, index) => {
            const songElement = document.createElement('div');
            songElement.className = 'rating-song-item';
            songElement.innerHTML = `
                <div class="song-info">
                    <span class="song-number">${index + 1}</span>
                    <span class="song-name">${song.name}</span>
                </div>
                <div class="song-ratings">
                    <span class="song-rating">Min: ${song.min_rating}</span>
                    <span class="song-rating">Max: ${song.max_rating}</span>
                    <span class="song-rating final">Final: ${song.rate.toFixed(3)}</span>
                </div>
                <div class="song-actions">
                    <button class="edit-song-btn" data-index="${index}">Editar</button>
                    <button class="delete-song-btn" data-index="${index}">Eliminar</button>
                </div>
            `;

            container.appendChild(songElement);
        });

        // Add event listeners for edit and delete buttons
        container.querySelectorAll('.edit-song-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const index = parseInt(e.target.dataset.index);
                this.editSong(index);
            });
        });

        container.querySelectorAll('.delete-song-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const index = parseInt(e.target.dataset.index);
                this.deleteSong(index);
            });
        });

        // Enable/disable complete button
        const completeBtn = document.getElementById('complete-rating-btn');
        completeBtn.disabled = this.currentSongs.length === 0;
    }

    editSong(index) {
        const song = this.currentSongs[index];
        const nameInput = document.getElementById('song-name-input');
        const minRatingInput = document.getElementById('song-min-rating');
        const maxRatingInput = document.getElementById('song-max-rating');

        nameInput.value = song.name;
        minRatingInput.value = song.min_rating;
        maxRatingInput.value = song.max_rating;

        // Remove the song from the array (will be re-added when user clicks "Agregar")
        this.currentSongs.splice(index, 1);
        this.updateSongsList();
        this.updateAlbumRating();
    }

    deleteSong(index) {
        this.currentSongs.splice(index, 1);
        this.updateSongsList();
        this.updateAlbumRating();
    }

    updateAlbumRating() {
        if (this.currentSongs.length === 0) {
            document.getElementById('current-album-rating').textContent = '0.0000';
            document.getElementById('album-rating-stars').innerHTML = '';
            return;
        }

        // Calculate album rating as average of all song ratings
        const totalRating = this.currentSongs.reduce((sum, song) => sum + song.rate, 0);
        const albumRating = totalRating / this.currentSongs.length;

        document.getElementById('current-album-rating').textContent = albumRating.toFixed(4);
        
        const stars = this.getAlbumStarRating(albumRating);
        document.getElementById('album-rating-stars').innerHTML = stars;
    }

    async confirmRating() {
        if (this.currentSongs.length === 0) {
            alert('Debes agregar al menos una canción para calificar el álbum');
            return;
        }

        const albumRating = parseFloat(document.getElementById('current-album-rating').textContent);
        
        // First confirmation
        const firstConfirm = confirm(
            `¿Estás seguro de que quieres calificar el álbum "${this.currentRatingAlbum.name}"?\n\n` +
            `Calificación final: ${albumRating.toFixed(2)}\n` +
            `Número de canciones: ${this.currentSongs.length}\n\n` +
            `Esta acción moverá el álbum de rotación a calificados.`
        );

        if (!firstConfirm) return;

        // Second confirmation (double check)
        const secondConfirm = confirm(
            `CONFIRMACIÓN FINAL\n\n` +
            `Vas a calificar "${this.currentRatingAlbum.name}" con ${albumRating.toFixed(2)} estrellas.\n` +
            `El álbum será ELIMINADO de rotación y AGREGADO a calificados.\n\n` +
            `¿Estás completamente seguro? Esta acción no se puede deshacer.`
        );

        if (!secondConfirm) return;

        // Complete the rating
        await this.completeRating(albumRating);
    }

    async completeRating(albumRating) {
        // Calculate avg_rate based on rating ranges
        let avgRate;
        if (albumRating < 4.5) {
            avgRate = 4;
        } else if (albumRating < 4.75) {
            avgRate = 4.5;
        } else {
            avgRate = 5;
        }

        // Create new album object for ratings
        const ratedAlbum = {
            ...this.currentRatingAlbum,
            rate: albumRating,
            avg_rate: avgRate,
            songs: this.currentSongs,
            like_percentage: this.calculateLikePercentage(),
            duration: this.currentRatingAlbum.minutes // Add duration from minutes
        };

        // Remove pending_listens and remaining from rated album
        delete ratedAlbum.pending_listens;
        delete ratedAlbum.remaining;

        // Add to ratings data
        this.ratingsData.push(ratedAlbum);

        // Remove from rotation data
        const rotationIndex = this.rotationData.indexOf(this.currentRatingAlbum);
        if (rotationIndex > -1) {
            this.rotationData.splice(rotationIndex, 1);
        }

        // Save to localStorage and file for persistence
        await this.saveDataToStorage();

        // Close modal
        document.getElementById('rating-modal').classList.remove('active');

        // Re-render both sections
        await this.renderRotation();
        await this.renderRatings();
        this.renderDashboard();

        alert(`¡Álbum "${ratedAlbum.name}" calificado exitosamente con ${albumRating.toFixed(2)} estrellas!`);
    }

    calculateLikePercentage() {
        return this.calculateAlbumLikePercentage(this.currentSongs);
    }

    // Goals Methods
    openGoalsModal() {
        const modal = document.getElementById('goals-modal');
        const dailyInput = document.getElementById('daily-goal-input');
        const weeklyInput = document.getElementById('weekly-goal-input');
        const initialDailyInput = document.getElementById('initial-daily-goal-input');
        const initialWeeklyInput = document.getElementById('initial-weekly-goal-input');

        dailyInput.value = this.goalsData.daily_goal;
        weeklyInput.value = this.goalsData.weekly_goal;
        initialDailyInput.value = this.goalsData.initial_daily_goal || 5.3722;
        initialWeeklyInput.value = this.goalsData.initial_weekly_goal || 5.6236;

        modal.classList.add('active');
    }

    async saveGoals() {
        const dailyInput = document.getElementById('daily-goal-input');
        const weeklyInput = document.getElementById('weekly-goal-input');
        const initialDailyInput = document.getElementById('initial-daily-goal-input');
        const initialWeeklyInput = document.getElementById('initial-weekly-goal-input');

        const dailyGoal = parseFloat(dailyInput.value);
        const weeklyGoal = parseFloat(weeklyInput.value);
        const initialDailyGoal = parseFloat(initialDailyInput.value);
        const initialWeeklyGoal = parseFloat(initialWeeklyInput.value);

        if (isNaN(dailyGoal) || isNaN(weeklyGoal) || dailyGoal < 0 || weeklyGoal < 0) {
            alert('Por favor ingresa valores válidos para los objetivos');
            return;
        }

        if (isNaN(initialDailyGoal) || isNaN(initialWeeklyGoal) || initialDailyGoal < 0 || initialWeeklyGoal < 0) {
            alert('Por favor ingresa valores válidos para los objetivos iniciales');
            return;
        }

        this.goalsData = {
            daily_goal: dailyGoal,
            weekly_goal: weeklyGoal,
            initial_daily_goal: initialDailyGoal,
            initial_weekly_goal: initialWeeklyGoal
        };

        try {
            const response = await fetch(`${this.apiBaseUrl}/goals`, {
                method: 'PUT',
                headers: this.getAuthHeaders(),
                body: JSON.stringify(this.goalsData)
            });

            if (response.ok) {
                console.log('✅ Objetivos guardados exitosamente');
                document.getElementById('goals-modal').classList.remove('active');
                this.updateGoalsDisplay();
            } else {
                console.error('❌ Error guardando objetivos:', response.status);
                alert('Error al guardar los objetivos');
            }
        } catch (error) {
            console.error('❌ Error guardando objetivos:', error);
            alert('Error al guardar los objetivos');
        }
    }

    updateGoalsDisplay() {
        const totalMinutes = this.rotationData.reduce((sum, album) => sum + (album.remaining || 0), 0);
        const totalDays = (totalMinutes / 60) / 24; // Convert minutes to days
        
        // Update goal displays
        document.getElementById('daily-goal-display').textContent = `${this.goalsData.daily_goal.toFixed(4)} días`;
        document.getElementById('weekly-goal-display').textContent = `${this.goalsData.weekly_goal.toFixed(4)} días`;

        // Calculate progress based on the new formula:
        // Initial goal (0%): initial_daily_goal
        // Final goal (100%): daily_goal
        // Current percentage: totalDays
        // Progress = ((initial - current) / (initial - goal)) * 100
        
        const initialDaily = this.goalsData.initial_daily_goal || 5.3722;
        const initialWeekly = this.goalsData.initial_weekly_goal || 5.6236;
        
        const dailyRange = initialDaily - this.goalsData.daily_goal;
        const dailyProgress = dailyRange > 0 
            ? Math.min(((initialDaily - totalDays) / dailyRange) * 100, 100)
            : 0;

        const weeklyRange = initialWeekly - this.goalsData.weekly_goal;
        const weeklyProgress = weeklyRange > 0 
            ? Math.min(((initialWeekly - totalDays) / weeklyRange) * 100, 100)
            : 0;

        // Update progress bars
        document.getElementById('daily-progress').style.width = `${dailyProgress}%`;
        document.getElementById('weekly-progress').style.width = `${weeklyProgress}%`;

        // Update progress text with 4 decimal places - showing reduction progress
        const dailyRemaining = Math.max(totalDays - this.goalsData.daily_goal, 0);
        const weeklyRemaining = Math.max(totalDays - this.goalsData.weekly_goal, 0);
        
        document.getElementById('daily-progress-text').textContent = 
            `Restante: ${dailyRemaining.toFixed(4)} días`;
        document.getElementById('weekly-progress-text').textContent = 
            `Restante: ${weeklyRemaining.toFixed(4)} días`;

        // Change color if goal is reached
        const dailyProgressBar = document.getElementById('daily-progress');
        const weeklyProgressBar = document.getElementById('weekly-progress');

        if (dailyProgress >= 100 || totalDays <= this.goalsData.daily_goal) {
            dailyProgressBar.style.background = 'linear-gradient(90deg, #4caf50 0%, #8bc34a 100%)';
        } else {
            dailyProgressBar.style.background = 'linear-gradient(90deg, #ff9800 0%, #ffc107 100%)';
        }

        if (weeklyProgress >= 100 || totalDays <= this.goalsData.weekly_goal) {
            weeklyProgressBar.style.background = 'linear-gradient(90deg, #4caf50 0%, #8bc34a 100%)';
        } else {
            weeklyProgressBar.style.background = 'linear-gradient(90deg, #ff9800 0%, #ffc107 100%)';
        }
    }

    // Add Vinyl Modal Methods
    openAddVinylModal() {
        const modal = document.getElementById('add-vinyl-modal');
        
        // Clear all form fields
        document.getElementById('vinyl-name').value = '';
        document.getElementById('vinyl-artist').value = '';
        document.getElementById('vinyl-year').value = '';
        document.getElementById('vinyl-release-date').value = '';
        document.getElementById('vinyl-country').value = '';
        document.getElementById('vinyl-main-genre').value = '';
        document.getElementById('vinyl-genre').value = '';
        document.getElementById('vinyl-color').value = 'Negro';
        document.getElementById('vinyl-status').value = 'No Escuchado';
        document.getElementById('vinyl-image').value = '';
        document.getElementById('vinyl-rate').value = '';
        document.getElementById('vinyl-avg-rate').value = '';

        modal.classList.add('active');
    }

    async saveVinyl() {
        const name = document.getElementById('vinyl-name').value.trim();
        const artist = document.getElementById('vinyl-artist').value.trim();
        const year = document.getElementById('vinyl-year').value.trim();
        const releaseDate = document.getElementById('vinyl-release-date').value.trim();
        const country = document.getElementById('vinyl-country').value.trim();
        const mainGenre = document.getElementById('vinyl-main-genre').value.trim();
        const genre = document.getElementById('vinyl-genre').value.trim();
        const vinylColor = document.getElementById('vinyl-color').value;
        const status = document.getElementById('vinyl-status').value;
        const image = document.getElementById('vinyl-image').value.trim();
        const rate = document.getElementById('vinyl-rate').value;
        const avgRate = document.getElementById('vinyl-avg-rate').value;

        // Validation
        if (!name || !artist || !year || !country || !mainGenre) {
            alert('Por favor completa todos los campos obligatorios (*)');
            return;
        }

        const yearNum = parseInt(year);
        if (isNaN(yearNum) || yearNum < 1900 || yearNum > 2099) {
            alert('Por favor ingresa un año válido entre 1900 y 2099');
            return;
        }

        // Create new vinyl object
        const newVinyl = {
            name: name,
            artist: artist,
            year: yearNum,
            release_date: releaseDate || '',
            country: country,
            main_genre: mainGenre,
            genre: genre || '',
            vinyl_color: vinylColor,
            status: status,
            image: image || 'https://via.placeholder.com/400?text=No+Image',
            rate: rate ? parseFloat(rate) : null,
            avg_rate: rate ? (() => {
                const r = parseFloat(rate);
                if (r < 4.5) return 4;
                if (r < 4.75) return 4.5;
                return 5;
            })() : null
        };

        console.log('🎵 Agregando nuevo vinilo:', newVinyl);

        // Add to vinyl data
        this.vinylData.push(newVinyl);

        // Save to server and localStorage
        await this.saveVinylData();

        // Re-render vinyl section
        this.renderVinyl();

        // Update dashboard stats
        this.renderDashboard();

        // Close modal
        document.getElementById('add-vinyl-modal').classList.remove('active');

        alert(`¡Vinilo "${name}" agregado exitosamente!`);
    }

    // Add Rotation Album Modal Methods
    openAddRotationModal() {
        const modal = document.getElementById('add-rotation-modal');

        // Clear all form fields
        document.getElementById('rotation-name').value = '';
        document.getElementById('rotation-artist').value = '';
        document.getElementById('rotation-year').value = '';
        document.getElementById('rotation-country').value = '';
        document.getElementById('rotation-genre').value = '';
        document.getElementById('rotation-main-genre').value = '';
        document.getElementById('rotation-pending-listens').value = '1';
        document.getElementById('rotation-minutes').value = '';
        document.getElementById('rotation-image').value = '';
        document.getElementById('rotation-listened').value = 'false';

        modal.classList.add('active');
    }

    async saveRotationAlbum() {
        const name = document.getElementById('rotation-name').value.trim();
        const artist = document.getElementById('rotation-artist').value.trim();
        const year = document.getElementById('rotation-year').value.trim();
        const country = document.getElementById('rotation-country').value.trim();
        const genre = document.getElementById('rotation-genre').value.trim();
        const mainGenre = document.getElementById('rotation-main-genre').value.trim();
        const pendingListens = document.getElementById('rotation-pending-listens').value.trim();
        const minutes = document.getElementById('rotation-minutes').value.trim();
        const image = document.getElementById('rotation-image').value.trim();
        const listened = document.getElementById('rotation-listened').value === 'true';

        // Validation
        if (!name || !artist || !year || !country || !genre || !mainGenre || !pendingListens || !minutes) {
            alert('Por favor completa todos los campos obligatorios (*)');
            return;
        }

        const yearNum = parseInt(year);
        if (isNaN(yearNum) || yearNum < 1900 || yearNum > 2099) {
            alert('Por favor ingresa un año válido entre 1900 y 2099');
            return;
        }

        const pendingListensNum = parseInt(pendingListens);
        if (isNaN(pendingListensNum) || pendingListensNum < 1) {
            alert('Por favor ingresa un número válido de escuchas pendientes (mínimo 1)');
            return;
        }

        const minutesNum = parseInt(minutes);
        if (isNaN(minutesNum) || minutesNum < 1) {
            alert('Por favor ingresa una duración válida en minutos (mínimo 1)');
            return;
        }

        // Calculate remaining time
        const remaining = pendingListensNum * minutesNum;

        // Create new rotation album object
        const newRotationAlbum = {
            name: name,
            artist: artist,
            year: yearNum,
            country: country,
            genre: genre,
            main_genre: mainGenre,
            pending_listens: pendingListensNum,
            minutes: minutesNum,
            remaining: remaining,
            image: image || 'https://via.placeholder.com/400?text=No+Image',
            listened: listened
        };

        console.log('🎵 Agregando nuevo álbum a rotación:', newRotationAlbum);

        // Add to rotation data
        this.rotationData.push(newRotationAlbum);

        // Save to server and localStorage
        await this.saveDataToStorage();

        // Re-render rotation section
        this.renderRotation();

        // Close modal
        document.getElementById('add-rotation-modal').classList.remove('active');

        alert(`¡Álbum "${name}" agregado a rotación exitosamente!`);
    }

    // Edit Song Rating Methods
    openEditSongRatingModal(album, songIndex, albumIndex) {
        const modal = document.getElementById('edit-song-rating-modal');
        const song = album.songs[songIndex];

        // Set current values
        document.getElementById('edit-song-album-name').textContent = album.name;
        document.getElementById('edit-song-name').textContent = song.name;
        document.getElementById('edit-song-min-rating').value = song.min_rating || 0;
        document.getElementById('edit-song-max-rating').value = song.max_rating || 0;
        
        // Calculate and display current rating
        const currentRating = (song.min_rating + song.max_rating) / 2;
        document.getElementById('edit-song-calculated-rating').textContent = currentRating.toFixed(3);

        // Store current editing info
        this.currentEditSong = {
            album: album,
            songIndex: songIndex,
            albumIndex: albumIndex
        };

        modal.classList.add('active');
    }

    async saveSongRatingEdit() {
        if (!this.currentEditSong) {
            console.error('No song currently being edited');
            return;
        }

        const minRating = parseFloat(document.getElementById('edit-song-min-rating').value);
        const maxRating = parseFloat(document.getElementById('edit-song-max-rating').value);

        // Validation
        if (isNaN(minRating) || isNaN(maxRating)) {
            alert('Por favor ingresa calificaciones válidas');
            return;
        }

        if (minRating < 0 || minRating > 6 || maxRating < 0 || maxRating > 6) {
            alert('Las calificaciones deben estar entre 0 y 6');
            return;
        }

        if (minRating > maxRating) {
            alert('La calificación mínima no puede ser mayor que la máxima');
            return;
        }

        const { album, songIndex, albumIndex } = this.currentEditSong;
        const calculatedRating = (minRating + maxRating) / 2;

        // Update song rating
        album.songs[songIndex].min_rating = minRating;
        album.songs[songIndex].max_rating = maxRating;
        album.songs[songIndex].rate = calculatedRating;

        console.log(`🔄 Actualizando calificación de canción "${album.songs[songIndex].name}": ${calculatedRating.toFixed(2)}`);

        // Recalculate album rating
        await this.recalculateAlbumRating(album);

        // Save to storage
        await this.saveDataToStorage();

        // Re-render UI
        await this.renderRatings();
        this.renderDashboard();

        // Close modal
        document.getElementById('edit-song-rating-modal').classList.remove('active');

        // Refresh album details modal if it's open
        this.showAlbumDetails(album);

        alert(`Calificación de canción actualizada exitosamente. Nueva calificación del álbum: ${album.rate.toFixed(4)}`);
    }

    async recalculateAlbumRating(album) {
        if (!album.songs || album.songs.length === 0) {
            console.warn('Álbum sin canciones para recalcular');
            return;
        }

        // Calculate new album rating as average of all song ratings
        const totalRating = album.songs.reduce((sum, song) => sum + song.rate, 0);
        const newAlbumRating = totalRating / album.songs.length;

        // Update album rating
        album.rate = newAlbumRating;

        // Recalculate like percentage
        album.like_percentage = this.calculateAlbumLikePercentage(album.songs);

        console.log(`📊 Nueva calificación del álbum "${album.name}": ${newAlbumRating.toFixed(4)}`);
        console.log(`📊 Nuevo porcentaje de likes: ${album.like_percentage.toFixed(1)}%`);
    }

    calculateAlbumLikePercentage(songs) {
        if (!songs || songs.length === 0) return 0;

        // Calculate percentage of songs with rating >= 4.75
        const songs475Plus = songs.filter(song => song.rate >= 4.75).length;
        const percentage475 = (songs475Plus / songs.length) * 100;

        // Calculate percentage of songs with rating >= 4.5
        const songs45Plus = songs.filter(song => song.rate >= 4.5).length;
        const percentage45 = (songs45Plus / songs.length) * 100;

        // Average of both percentages
        return (percentage475 + percentage45) / 2;
    }

    // Authentication Methods
    setupAuthListeners() {
        const loginBtn = document.getElementById('login-btn');
        const logoutBtn = document.getElementById('logout-btn');
        const loginSubmitBtn = document.getElementById('login-submit-btn');
        const loginModal = document.getElementById('login-modal');

        if (loginBtn) {
            loginBtn.addEventListener('click', () => {
                loginModal.classList.add('active');
            });
        }

        if (logoutBtn) {
            logoutBtn.addEventListener('click', () => {
                this.logout();
            });
        }

        if (loginSubmitBtn) {
            loginSubmitBtn.addEventListener('click', () => this.login());
        }

        if (loginModal) {
            loginModal.addEventListener('click', (e) => {
                if (e.target.id === 'login-modal') {
                    loginModal.classList.remove('active');
                }
            });
        }
    }

    async login() {
        const username = document.getElementById('login-username').value;
        const password = document.getElementById('login-password').value;

        try {
            const response = await fetch(`${this.apiBaseUrl}/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password })
            });

            const data = await response.json();

            if (response.ok) {
                this.token = data.token;
                localStorage.setItem('authToken', this.token);
                this.isAdmin = true;
                this.updateUIForAuth();
                document.getElementById('login-modal').classList.remove('active');
                alert(`¡Bienvenido, ${data.username}!`);
            } else {
                alert(data.error || 'Error al iniciar sesión');
            }
        } catch (error) {
            console.error('Login error:', error);
            alert('Error al conectar con el servidor');
        }
    }

    logout() {
        this.token = null;
        this.isAdmin = false;
        localStorage.removeItem('authToken');
        this.updateUIForAuth();
        alert('Has cerrado sesión');
    }

    updateUIForAuth() {
        const loginBtn = document.getElementById('login-btn');
        const logoutBtn = document.getElementById('logout-btn');

        if (this.isAdmin) {
            loginBtn.style.display = 'none';
            logoutBtn.style.display = 'block';
        } else {
            loginBtn.style.display = 'block';
            logoutBtn.style.display = 'none';
        }

        // Disable/enable write actions based on auth
        const writeActions = document.querySelectorAll(
            '.edit-song-rating-btn, .rotation-btn, .rate-album-btn, .add-vinyl-btn, .add-rotation-btn, ' +
            '.edit-song-rating-button, .save-song-rating-button, .save-vinyl-button, .save-rotation-btn, ' +
            '.listened-status, .reset-listened-btn, .reset-rotation-listened-btn, .change-status-button, ' +
            '#edit-goals-btn, #save-goals-btn, #change-vinyl-status-btn'
        );
        writeActions.forEach(btn => {
            btn.disabled = !this.isAdmin;
            btn.style.opacity = this.isAdmin ? '1' : '0.5';
            btn.style.cursor = this.isAdmin ? 'pointer' : 'not-allowed';
        });
    }

    getAuthHeaders() {
        const headers = { 'Content-Type': 'application/json' };
        if (this.token) {
            headers['Authorization'] = `Bearer ${this.token}`;
        }
        return headers;
    }
}

// Initialize the app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new MusicApp();

    // Download buttons
    document.querySelectorAll('.download-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const file = btn.dataset.file;
            const url = `${window.location.origin}/api/download/${file}`;
            window.location.href = url;
        });
    });
});