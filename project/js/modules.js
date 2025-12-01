// Módulos de funcionalidad específica

// Módulo de búsqueda
const SearchModule = {
    init() {
        this.searchInput = document.getElementById('searchInput');
        this.searchBtn = document.getElementById('searchBtn');
        this.bindEvents();
    },
    
    bindEvents() {
        this.searchInput.addEventListener('input', (e) => {
            this.handleSearch(e.target.value);
        });
        
        this.searchBtn.addEventListener('click', () => {
            this.handleSearch(this.searchInput.value);
        });
        
        this.searchInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.handleSearch(this.searchInput.value);
            }
        });
    },
    
    handleSearch(query) {
        if (typeof window.IndieHubApp !== 'undefined') {
            window.IndieHubApp.handleSearch(query);
        }
    }
};

// Módulo de filtros
const FiltersModule = {
    init() {
        this.filterContainer = document.getElementById('filterOptions');
        this.renderFilters();
        this.bindEvents();
    },
    
    renderFilters() {
        if (!this.filterContainer) return;
        
        this.filterContainer.innerHTML = mockData.categories.map(category => `
            <button class="filter-btn ${category.active ? 'active' : ''}" 
                    data-filter="${category.id}">
                ${category.name}
            </button>
        `).join('');
    },
    
    bindEvents() {
        this.filterContainer.addEventListener('click', (e) => {
            if (e.target.classList.contains('filter-btn')) {
                const filterType = e.target.dataset.filter;
                this.handleFilterChange(filterType, e.target);
            }
        });
    },
    
    handleFilterChange(filterType, button) {
        // Actualizar estado activo
        document.querySelectorAll('.filter-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        button.classList.add('active');
        
        if (typeof window.IndieHubApp !== 'undefined') {
            window.IndieHubApp.handleFilterChange(filterType);
        }
    }
};

// Módulo de autenticación
const AuthModule = {
    init() {
        this.loginBtn = document.getElementById('loginBtn');
        this.signupBtn = document.getElementById('signupBtn');
        this.loginModal = document.getElementById('loginModal');
        this.signupModal = document.getElementById('signupModal');
        this.bindEvents();
    },
    
    bindEvents() {
        this.loginBtn.addEventListener('click', () => this.showLoginModal());
        this.signupBtn.addEventListener('click', () => this.showSignupModal());
        
        // Cerrar modales
        document.querySelectorAll('.close-modal').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.target.closest('.modal').classList.remove('active');
            });
        });
        
        // Cerrar modal al hacer click fuera
        document.querySelectorAll('.modal').forEach(modal => {
            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    modal.classList.remove('active');
                }
            });
        });
        
        // Form submissions
        document.getElementById('loginForm')?.addEventListener('submit', (e) => this.handleLogin(e));
        document.getElementById('signupForm')?.addEventListener('submit', (e) => this.handleSignup(e));
    },
    
    showLoginModal() {
        this.loginModal.classList.add('active');
    },
    
    showSignupModal() {
        this.signupModal.classList.add('active');
    },
    
    async handleLogin(e) {
        e.preventDefault();
        const formData = new FormData(e.target);
        const credentials = {
            email: formData.get('email'),
            password: formData.get('password')
        };
        
        // Simular login
        await delay(800);
        
        if (typeof window.IndieHubApp !== 'undefined') {
            window.IndieHubApp.handleAuth({
                id: 1001,
                name: "Usuario Demo",
                email: credentials.email,
                avatar: "https://via.placeholder.com/100/339af0/FFFFFF?text=UD"
            });
        }
        
        this.loginModal.classList.remove('active');
        showNotification('¡Sesión iniciada correctamente!', 'success');
    },
    
    async handleSignup(e) {
        e.preventDefault();
        const formData = new FormData(e.target);
        const userData = {
            name: formData.get('username'),
            email: formData.get('email'),
            password: formData.get('password')
        };
        
        // Simular registro
        await delay(800);
        
        if (typeof window.IndieHubApp !== 'undefined') {
            window.IndieHubApp.handleAuth({
                id: Date.now(),
                name: userData.name,
                email: userData.email,
                avatar: "https://via.placeholder.com/100/51cf66/FFFFFF?text=NU"
            });
        }
        
        this.signupModal.classList.remove('active');
        showNotification('¡Cuenta creada exitosamente!', 'success');
    }
};

// Módulo de comentarios
const CommentsModule = {
    init() {
        this.commentForm = document.getElementById('commentForm');
        this.ratingStars = document.getElementById('ratingStars');
        this.currentRating = 0;
        this.renderStars();
        this.bindEvents();
    },
    
    renderStars() {
        if (!this.ratingStars) return;
        
        this.ratingStars.innerHTML = '';
        for (let i = 1; i <= 5; i++) {
            const star = document.createElement('button');
            star.type = 'button';
            star.className = 'star';
            star.innerHTML = '☆';
            star.dataset.rating = i;
            this.ratingStars.appendChild(star);
        }
    },
    
    bindEvents() {
        // Rating con estrellas
        this.ratingStars.addEventListener('click', (e) => {
            if (e.target.classList.contains('star')) {
                this.setRating(parseInt(e.target.dataset.rating));
            }
        });
        
        this.ratingStars.addEventListener('mouseover', (e) => {
            if (e.target.classList.contains('star')) {
                this.highlightStars(parseInt(e.target.dataset.rating));
            }
        });
        
        this.ratingStars.addEventListener('mouseout', () => {
            this.highlightStars(this.currentRating);
        });
        
        // Envío de comentarios
        this.commentForm.addEventListener('submit', (e) => this.handleCommentSubmit(e));
    },
    
    setRating(rating) {
        this.currentRating = rating;
        this.highlightStars(rating);
    },
    
    highlightStars(rating) {
        const stars = this.ratingStars.querySelectorAll('.star');
        stars.forEach((star, index) => {
            star.innerHTML = index < rating ? '★' : '☆';
            star.classList.toggle('active', index < rating);
        });
    },
    
    async handleCommentSubmit(e) {
        e.preventDefault();
        
        const commentText = document.getElementById('commentText').value;
        
        if (!commentText.trim()) {
            showNotification('Por favor escribe un comentario', 'error');
            return;
        }
        
        if (this.currentRating === 0) {
            showNotification('Por favor selecciona una calificación', 'error');
            return;
        }
        
        if (typeof window.IndieHubApp !== 'undefined') {
            window.IndieHubApp.handleCommentSubmit({
                rating: this.currentRating,
                text: commentText
            });
        }
        
        // Limpiar formulario
        this.commentForm.reset();
        this.setRating(0);
        showNotification('¡Comentario publicado!', 'success');
    }
};