// Datos de ejemplo para la aplicación
const mockData = {
    projects: [
        {
            id: 1,
            title: "Duck Souls",
            author: "Duckington the Thrid",
            authorId: 1,
            description: "Lucha por las migas de pan, en esta aventura sin fin deberás vencer a las gaviotas para asegurarte un estómago lleno.",
            image: "https://via.placeholder.com/300x180/4A90E2/FFFFFF?text=DuckSouls",
            rating: 4.8,
            reviews: 124,
            downloads: 2400,
            price: 0,
            category: "games",
            tags: ["plataformas", "pixel-art", "espacial"]
        },
        {
            id: 2,
            title: "Fantasy UI Pack",
            author: "DesignWizard",
            authorId: 2,
            description: "Un paquete completo de elementos de UI para juegos de fantasía. Incluye botones, barras de salud, marcos y más.",
            image: "https://via.placeholder.com/300x180/50E3C2/FFFFFF?text=Fantasy+UI+Pack",
            rating: 4.5,
            reviews: 89,
            downloads: 1700,
            price: 9.99,
            category: "assets",
            tags: ["ui", "fantasía", "recursos"]
        },
        {
            id: 3,
            title: "SynthWave OST",
            author: "AudioAlchemist",
            authorId: 3,
            description: "Banda sonora synthwave con 10 pistas para tus juegos retro. Perfecta para juegos de carreras o ambientación futurista.",
            image: "https://via.placeholder.com/300x180/B8E986/FFFFFF?text=SynthWave+OST",
            rating: 4.9,
            reviews: 67,
            downloads: 890,
            price: 4.99,
            category: "music",
            tags: ["música", "synthwave", "retro"]
        },
        {
            id: 4,
            title: "Pixel Art Generator",
            author: "ToolMaster",
            authorId: 4,
            description: "Una herramienta para convertir imágenes en arte pixel automáticamente. Soporta múltiples formatos y tamaños.",
            image: "https://via.placeholder.com/300x180/9013FE/FFFFFF?text=Pixel+Art+Generator",
            rating: 4.3,
            reviews: 42,
            downloads: 1200,
            price: 0,
            category: "tools",
            tags: ["herramienta", "pixel-art", "conversión"]
        },
        {
            id: 5,
            title: "Cyberpunk Character Pack",
            author: "ModelMaker",
            authorId: 5,
            description: "Paquete de 10 personajes cyberpunk listos para usar en tus proyectos. Incluye animaciones básicas.",
            image: "https://via.placeholder.com/300x180/FF6B6B/FFFFFF?text=Cyberpunk+Characters",
            rating: 4.7,
            reviews: 156,
            downloads: 3100,
            price: 12.99,
            category: "assets",
            tags: ["personajes", "cyberpunk", "3d"]
        },
        {
            id: 6,
            title: "Forest Soundscape",
            author: "AudioAlchemist",
            authorId: 3,
            description: "Colección de sonidos ambientales de bosque. Perfecto para juegos de aventuras o relajación.",
            image: "https://via.placeholder.com/300x180/4A4A4A/FFFFFF?text=Forest+Soundscape",
            rating: 4.6,
            reviews: 78,
            downloads: 950,
            price: 3.99,
            category: "music",
            tags: ["sonidos", "ambiental", "bosque"]
        }
    ],

    categories: [
        { id: 'all', name: 'Todos', active: true },
        { id: 'games', name: 'Juegos', active: false },
        { id: 'assets', name: 'Assets', active: false },
        { id: 'tools', name: 'Herramientas', active: false },
        { id: 'art', name: 'Arte', active: false },
        { id: 'music', name: 'Música', active: false },
        { id: 'free', name: 'Gratis', active: false },
        { id: 'paid', name: 'Pago', active: false }
    ],

    userProfile: {
        id: 1,
        name: "PixelPioneer",
        avatar: "https://via.placeholder.com/100/4A90E2/FFFFFF?text=PP",
        bio: "Creador de juegos indie con más de 5 años de experiencia. Especializado en juegos retro y pixel art. Apasionado por los juegos que cuentan historias únicas.",
        stats: {
            projects: 12,
            rating: 4.7,
            downloads: 8200,
            followers: 450
        }
    },

    comments: [
        {
            id: 1,
            author: "GameDevFan",
            avatar: "https://via.placeholder.com/40/50E3C2/FFFFFF?text=GF",
            rating: 5,
            text: "¡Increíble juego! Las mecánicas son muy fluidas y el arte es impresionante. Definitivamente recomiendo este proyecto.",
            date: "Hace 3 días"
        },
        {
            id: 2,
            author: "IndieLover",
            avatar: "https://via.placeholder.com/40/B8E986/FFFFFF?text=IL",
            rating: 4,
            text: "Muy buen concepto y ejecución. Me encantaría ver más niveles en futuras actualizaciones.",
            date: "Hace 1 semana"
        },
        {
            id: 3,
            author: "DevCreative",
            avatar: "https://via.placeholder.com/40/9013FE/FFFFFF?text=DC",
            rating: 5,
            text: "El arte pixel es excepcional. Se nota la dedicación en cada detalle. ¡Bravo!",
            date: "Hace 2 semanas"
        }
    ]
};