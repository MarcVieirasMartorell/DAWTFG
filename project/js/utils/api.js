// Mock API functions - In a real app, these would make actual API calls

export async function loadProjects() {
    // Simulate API call delay
    await new Promise(resolve => setTimeout(resolve, 500));
    
    return [
        {
            id: 1,
            title: "Cosmic Adventure",
            author: "PixelPioneer",
            authorId: 1,
            description: "Un juego de plataformas espacial con mecánicas únicas y arte pixel art.",
            image: "images/projects/cosmic-adventure.jpg",
            rating: 4.8,
            reviews: 124,
            downloads: 2400,
            price: 0,
            category: "games"
        },
        {
            id: 2,
            title: "Fantasy UI Pack",
            author: "DesignWizard",
            authorId: 2,
            description: "Un paquete completo de elementos de UI para juegos de fantasía.",
            image: "images/projects/fantasy-ui.jpg",
            rating: 4.5,
            reviews: 89,
            downloads: 1700,
            price: 9.99,
            category: "assets"
        },
        {
            id: 3,
            title: "SynthWave OST",
            author: "AudioAlchemist",
            authorId: 3,
            description: "Banda sonora synthwave con 10 pistas para tus juegos retro.",
            image: "images/projects/synthwave-ost.jpg",
            rating: 4.9,
            reviews: 67,
            downloads: 890,
            price: 4.99,
            category: "music"
        },
        {
            id: 4,
            title: "Pixel Art Generator",
            author: "ToolMaster",
            authorId: 4,
            description: "Una herramienta para convertir imágenes en arte pixel automáticamente.",
            image: "images/projects/pixel-generator.jpg",
            rating: 4.3,
            reviews: 42,
            downloads: 1200,
            price: 0,
            category: "tools"
        }
    ];
}

export async function loadUserProfile(userId) {
    await new Promise(resolve => setTimeout(resolve, 300));
    
    return {
        id: userId,
        name: "PixelPioneer",
        avatar: "images/avatars/pixelpioneer.jpg",
        bio: "Creador de juegos indie con más de 5 años de experiencia. Especializado en juegos retro y pixel art.",
        stats: {
            projects: 12,
            rating: 4.7,
            downloads: 8200
        }
    };
}

export async function loadComments(projectId) {
    await new Promise(resolve => setTimeout(resolve, 300));
    
    return [
        {
            id: 1,
            author: "GameDevFan",
            avatar: "images/avatars/gamedevfan.jpg",
            rating: 5,
            text: "¡Increíble juego! Las mecánicas son muy fluidas y el arte es impresionante. Definitivamente recomiendo este proyecto.",
            date: "Hace 3 días"
        },
        {
            id: 2,
            author: "IndieLover",
            avatar: "images/avatars/indielover.jpg",
            rating: 4,
            text: "Muy buen concepto y ejecución. Me encantaría ver más niveles en futuras actualizaciones.",
            date: "Hace 1 semana"
        }
    ];
}

export async function submitComment(projectId, comment) {
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 500));
    
    return {
        success: true,
        commentId: Date.now()
    };
}

export async function loginUser(credentials) {
    await new Promise(resolve => setTimeout(resolve, 800));
    
    // Mock authentication
    if (credentials.email && credentials.password) {
        return {
            id: 1,
            name: "Usuario Demo",
            email: credentials.email,
            avatar: "images/avatars/default-avatar.png"
        };
    }
    
    throw new Error("Credenciales inválidas");
}

export async function registerUser(userData) {
    await new Promise(resolve => setTimeout(resolve, 800));
    
    return {
        id: Date.now(),
        name: userData.name,
        email: userData.email,
        avatar: "images/avatars/default-avatar.png"
    };
}