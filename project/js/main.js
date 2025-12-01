class IndieHubApp {
    constructor() {
        this.currentUser = null;
        this.projects = [];
        this.filters = {
            category: 'all',
            price: 'all',
            rating: 'all'
        };
        
        this.init();
    }
    
    async init() {
        // Load initial data
        await this.loadInitialData();
        
        // Initialize modules
        SearchModule.init();
        FiltersModule.init();
        AuthModule.init();
        CommentsModule.init();
        
        // Set up event listeners
        this.setupEventListeners();
        
        console.log('IndieHub app initialized');
    }
    
    async loadInitialData() {
        try {
            // Simular carga de datos
            await delay(500);
            
            this.projects = mockData.projects;
            this.renderProjects(this.projects);
            
            this.renderProfile(mockData.userProfile);
            this.renderComments(mockData.comments);
        } catch (error) {
            console.error('Error loading initial data:', error);
        }
    }
    
    handleSearch(query) {
        const filteredProjects = searchProjects(this.projects, query);
        this.renderProjects(filteredProjects);
    }
    
    handleFilterChange(filterType) {
        // Actualizar filtros basado en el tipo
        if (['games', 'assets', 'tools', 'art', 'music'].includes(filterType)) {
            this.filters.category = filterType;
        } else if (['free', 'paid'].includes(filterType)) {
            this.filters.price = filterType;
        } else if (filterType === 'all') {
            this.filters.category = 'all';
            this.filters.price = 'all';
        }
        
        this.applyFilters();
    }
    
    applyFilters() {
        let filteredProjects = filterProjects(this.projects, this.filters);
        this.renderProjects(filteredProjects);
    }
    
    handleAuth(user) {
        this.currentUser = user;
        this.updateUIForAuthState();
    }
    
    handleCommentSubmit(commentData) {
        const newComment = {
            id: Date.now(),
            author: this.currentUser ? this.currentUser.name : 'Anónimo',
            avatar: this.currentUser ? this.currentUser.avatar : 'https://via.placeholder.com/40/767676/FFFFFF?text=?',
            rating: commentData.rating,
            text: commentData.text,
            date: 'Hace unos momentos'
        };
        
        this.addCommentToDOM(newComment);
    }
    
    renderProjects(projects) {
        const projectsGrid = document.getElementById('projectsGrid');
        if (!projectsGrid) return;
        
        if (projects.length === 0) {
            projectsGrid.innerHTML = `
                <div class="no-projects">
                    <h3>No se encontraron proyectos</h3>
                    <p>Intenta con otros términos de búsqueda o filtros diferentes.</p>
                </div>
            `;
            return;
        }
        
        projectsGrid.innerHTML = projects.map(project => `
            <div class="project-card" data-project-id="${project.id}">
                <div class="project-image" style="background-image: url('${project.image}')">
                    ${project.price === 0 ? '<span class="project-badge">Gratis</span>' : ''}
                </div>
                <div class="project-info">
                    <h3 class="project-title">${project.title}</h3>
                    <p class="project-author">por <a href="#profile-${project.authorId}">${project.author}</a></p>
                    <p class="project-description">${project.description}</p>
                    <div class="project-meta">
                        <span class="project-rating">${generateStars(project.rating)} ${project.rating} (${project.reviews})</span>
                        <span>Descargas: ${formatNumber(project.downloads)}</span>
                    </div>
                    <button class="download-btn" data-project-id="${project.id}">
                        ${project.price === 0 ? 'Descargar Gratis' : `Comprar $${project.price}`}
                    </button>
                </div>
            </div>
        `).join('');
    }
    
    renderProfile(profile) {
        const profileHeader = document.getElementById('profileHeader');
        if (!profileHeader) return;
        
        profileHeader.innerHTML = `
            <div class="profile-avatar">
                <img src="${profile.avatar}" alt="${profile.name}">
                <div class="avatar-upload">+</div>
            </div>
            <div class="profile-info">
                <h2>${profile.name}</h2>
                <p class="profile-bio">${profile.bio}</p>
                <div class="profile-stats">
                    <div class="stat">
                        <div class="stat-value">${profile.stats.projects}</div>
                        <div class="stat-label">Proyectos</div>
                    </div>
                    <div class="stat">
                        <div class="stat-value">${profile.stats.rating}</div>
                        <div class="stat-label">Rating</div>
                    </div>
                    <div class="stat">
                        <div class="stat-value">${formatNumber(profile.stats.downloads)}</div>
                        <div class="stat-label">Descargas</div>
                    </div>
                    <div class="stat">
                        <div class="stat-value">${formatNumber(profile.stats.followers)}</div>
                        <div class="stat-label">Seguidores</div>
                    </div>
                </div>
                <div class="profile-actions">
                    <button class="follow-btn">Seguir</button>
                    <button class="message-btn">Mensaje</button>
                </div>
            </div>
        `;
    }
    
    renderComments(comments) {
        const commentsList = document.getElementById('commentsList');
        if (!commentsList) return;
        
        commentsList.innerHTML = comments.map(comment => `
            <div class="comment">
                <div class="comment-avatar">
                    <img src="${comment.avatar}" alt="${comment.author}">
                </div>
                <div class="comment-content">
                    <div class="comment-header">
                        <span class="comment-author">${comment.author}</span>
                        <span class="comment-date">${comment.date}</span>
                    </div>
                    <div class="comment-rating">${generateStars(comment.rating)}</div>
                    <p class="comment-text">${comment.text}</p>
                    <div class="comment-actions">
                        <button class="comment-action">Me gusta</button>
                        <button class="comment-action">Responder</button>
                    </div>
                </div>
            </div>
        `).join('');
    }
    
    addCommentToDOM(comment) {
        const commentsList = document.getElementById('commentsList');
        if (!commentsList) return;
        
        const commentElement = document.createElement('div');
        commentElement.className = 'comment';
        commentElement.innerHTML = `
            <div class="comment-avatar">
                <img src="${comment.avatar}" alt="${comment.author}">
            </div>
            <div class="comment-content">
                <div class="comment-header">
                    <span class="comment-author">${comment.author}</span>
                    <span class="comment-date">${comment.date}</span>
                </div>
                <div class="comment-rating">${generateStars(comment.rating)}</div>
                <p class="comment-text">${comment.text}</p>
                <div class="comment-actions">
                    <button class="comment-action">Me gusta</button>
                    <button class="comment-action">Responder</button>
                </div>
            </div>
        `;
        
        commentsList.prepend(commentElement);
    }
    
    updateUIForAuthState() {
        const authButtons = document.getElementById('authButtons');
        if (this.currentUser) {
            authButtons.innerHTML = `
                <div class="user-menu">
                    <img src="${this.currentUser.avatar}" alt="${this.currentUser.name}" class="user-avatar">
                    <span>${this.currentUser.name}</span>
                </div>
            `;
        }
    }
    
    setupEventListeners() {
        // Download button handlers
        document.addEventListener('click', (e) => {
            if (e.target.classList.contains('download-btn')) {
                const projectId = e.target.dataset.projectId;
                this.handleDownload(projectId);
            }
            
            if (e.target.classList.contains('follow-btn')) {
                this.handleFollow();
            }
            
            if (e.target.id === 'uploadBtn') {
                this.handleUpload();
            }
        });
    }
    
    handleDownload(projectId) {
        const project = this.projects.find(p => p.id == projectId);
        if (project) {
            showNotification(`Descargando: ${project.title}`, 'success');
            // Simular descarga
            setTimeout(() => {
                showNotification(`${project.title} descargado exitosamente`, 'success');
            }, 1500);
        }
    }
    
    handleFollow() {
        showNotification('¡Ahora sigues a este creador!', 'success');
    }
    
    handleUpload() {
        showNotification('Funcionalidad de subida de proyectos (en desarrollo)', 'info');
    }
}

// Hacer disponible globalmente para los módulos
window.IndieHubApp = IndieHubApp;

// Inicializar la aplicación cuando el DOM esté listo
document.addEventListener('DOMContentLoaded', () => {
    new IndieHubApp();
});