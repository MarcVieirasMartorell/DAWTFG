// Utilidades generales para la aplicación

// Simular delay de API
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Formatear números
const formatNumber = (num) => {
    if (num >= 1000000) {
        return (num / 1000000).toFixed(1) + 'M';
    }
    if (num >= 1000) {
        return (num / 1000).toFixed(1) + 'K';
    }
    return num.toString();
};

// Generar estrellas de rating
const generateStars = (rating) => {
    const fullStars = Math.floor(rating);
    const halfStar = rating % 1 >= 0.5;
    const emptyStars = 5 - fullStars - (halfStar ? 1 : 0);
    
    let stars = '';
    for (let i = 0; i < fullStars; i++) stars += '★';
    if (halfStar) stars += '½';
    for (let i = 0; i < emptyStars; i++) stars += '☆';
    
    return stars;
};

// Filtrar proyectos
const filterProjects = (projects, filters) => {
    return projects.filter(project => {
        // Filtro por categoría
        if (filters.category !== 'all' && project.category !== filters.category) {
            return false;
        }
        
        // Filtro por precio
        if (filters.price === 'free' && project.price > 0) {
            return false;
        }
        if (filters.price === 'paid' && project.price === 0) {
            return false;
        }
        
        // Filtro por rating
        if (filters.rating !== 'all') {
            const minRating = parseInt(filters.rating);
            if (project.rating < minRating) {
                return false;
            }
        }
        
        return true;
    });
};

// Buscar proyectos
const searchProjects = (projects, query) => {
    if (!query.trim()) return projects;
    
    const searchTerm = query.toLowerCase();
    return projects.filter(project => 
        project.title.toLowerCase().includes(searchTerm) ||
        project.author.toLowerCase().includes(searchTerm) ||
        project.description.toLowerCase().includes(searchTerm) ||
        project.tags.some(tag => tag.toLowerCase().includes(searchTerm))
    );
};

// Guardar en localStorage
const saveToLocalStorage = (key, data) => {
    try {
        localStorage.setItem(key, JSON.stringify(data));
    } catch (error) {
        console.error('Error guardando en localStorage:', error);
    }
};

// Cargar desde localStorage
const loadFromLocalStorage = (key, defaultValue = null) => {
    try {
        const item = localStorage.getItem(key);
        return item ? JSON.parse(item) : defaultValue;
    } catch (error) {
        console.error('Error cargando desde localStorage:', error);
        return defaultValue;
    }
};

// Mostrar notificación
const showNotification = (message, type = 'info') => {
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.textContent = message;
    
    // Estilos básicos para la notificación
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        padding: 12px 20px;
        background: ${type === 'error' ? '#ff6b6b' : type === 'success' ? '#51cf66' : '#339af0'};
        color: white;
        border-radius: 4px;
        z-index: 10000;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        transform: translateX(100%);
        transition: transform 0.3s ease;
    `;
    
    document.body.appendChild(notification);
    
    // Animación de entrada
    setTimeout(() => {
        notification.style.transform = 'translateX(0)';
    }, 100);
    
    // Auto-remover después de 3 segundos
    setTimeout(() => {
        notification.style.transform = 'translateX(100%)';
        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        }, 300);
    }, 3000);
};