// ===== SISTEMA DE AUTH COMPLETO =====
function showRegister() {
    document.getElementById('velkommen').style.display = 'none';
    document.getElementById('login').style.display = 'none';
    document.getElementById('register').style.display = 'flex';
}

function useExistingUser() {
    document.getElementById('velkommen').style.display = 'none';
    document.getElementById('register').style.display = 'none';
    document.getElementById('login').style.display = 'flex';
}

function goBackToWelcome() {
    document.getElementById('login').style.display = 'none';
    document.getElementById('register').style.display = 'none';
    document.getElementById('velkommen').style.display = 'flex';
}

function togglePasswordVisibility(inputId, button) {
    const input = document.getElementById(inputId);
    const img = button.querySelector('img');
    
    if (input.type === 'password') {
        input.type = 'text';
        img.src = 'res/eye-open.svg';
        img.alt = 'Ocultar contraseña';
    } else {
        input.type = 'password';
        img.src = 'res/eye-closed.svg';
        img.alt = 'Ver contraseña';
    }
}

// Función de registro
async function registerUser() {
    const username = document.getElementById('registerUsername').value.trim();
    const password = document.getElementById('registerPassword').value.trim();
    const confirmPassword = document.getElementById('registerConfirmPassword').value.trim();
    const acceptTerms = document.getElementById('acceptTerms').checked;

    // Validaciones
    if (!username || !password || !confirmPassword) {
        alert('Por favor completa todos los campos');
        return;
    }

    if (username.length > 25) {
        alert('El usuario no puede tener más de 25 caracteres');
        return;
    }

    if (password !== confirmPassword) {
        alert('Las contraseñas no coinciden');
        return;
    }

    if (!acceptTerms) {
        alert('Debes aceptar los términos y condiciones');
        return;
    }

    try {
        const response = await fetch('/users', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });

        const data = await response.json();

        if (response.ok) {
            // Registro exitoso - iniciar sesión automáticamente
            await loginUserDirect(username, password);
        } else {
            alert(data.error || 'Error en el registro');
        }
    } catch (error) {
        console.error('Error en registro:', error);
        alert('Error de conexión');
    }
}

// Función de login
async function loginUser() {
    const username = document.getElementById('loginUsername').value.trim();
    const password = document.getElementById('loginPassword').value.trim();

    if (!username || !password) {
        alert('Por favor completa todos los campos');
        return;
    }

    await loginUserDirect(username, password);
}

// Función de login directo
async function loginUserDirect(username, password) {
    try {
        const response = await fetch('/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });

        const data = await response.json();

        if (response.ok) {
            // Login exitoso
            setActiveUser(data.username);
            closeAuthPopup();
        } else {
            alert(data.error || 'Error en el login');
        }
    } catch (error) {
        console.error('Error en login:', error);
        alert('Error de conexión');
    }
}

function closeAuthPopup() {
    document.querySelector('.authpopup').style.display = 'none';
    document.querySelector('.right-side').style.display = 'flex';
}

// Inicialización
document.addEventListener('DOMContentLoaded', function() {
    // Verificar si hay usuario guardado (para futuras sesiones)
    const savedUser = localStorage.getItem('activeUser');
    if (savedUser) {
        setActiveUser(savedUser);
        closeAuthPopup();
    }
    
    // Event listeners para inputs (enter key)
    const authInputs = document.querySelectorAll('.authInput');
    authInputs.forEach(input => {
        input.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                const formId = this.closest('.loginContainer').id;
                if (formId === 'login') {
                    loginUser();
                } else if (formId === 'register') {
                    registerUser();
                }
            }
        });
    });
});

// ===== SISTEMA DE POSTS =====
function autoResize(textarea) {
    textarea.style.height = 'auto';
    textarea.style.height = (textarea.scrollHeight) + 'px';
}

// Inicializar auto-resize para textareas
document.addEventListener('DOMContentLoaded', function() {
    const textareas = document.querySelectorAll('.textpost');
    
    textareas.forEach(textarea => {
        autoResize(textarea);
        
        textarea.addEventListener('input', function() {
            autoResize(this);
        });
    });
});

function containsForbiddenWords(message) {
    return forbiddenWords.some(word => message.toLowerCase().includes(word.toLowerCase()));
}

function handleFileSelect(event) {
    selectedFile = event.target.files[0];
    if (selectedFile) {
        const fileType = selectedFile.type;
        const fileSize = selectedFile.size;
        const validFileTypes = ['image', 'audio', 'video'];
        const fileCategory = fileType.split('/')[0];

        if (!validFileTypes.includes(fileCategory)) {
            alert("Por favor, selecciona un archivo de tipo imagen, audio o video.");
            selectedFile = null;
            event.target.value = '';
            return;
        }

        if (
            (fileCategory === 'image' || fileCategory === 'audio') && fileSize > 10 * 1024 * 1024 ||
            fileCategory === 'video' && fileSize > 20 * 1024 * 1024
        ) {
            alert("El archivo seleccionado excede el tamaño máximo permitido.");
            selectedFile = null;
            event.target.value = '';
            return;
        }
    }
}

function createPost() {
    const postContent = document.getElementById('textpost').value;
    const processedContent = postContent.trim();

    if (containsForbiddenWords(postContent)) {
        alert("Creemos que tu post infringe nuestros términos y condiciones.");
        return;
    }

    if (processedContent.length === 0) {
        alert("No podés cebar un post vacío.");
        return;
    }

    if (!activeUser) {
        alert("Debes iniciar sesión para publicar.");
        return;
    }

    // Aquí iría tu lógica para enviar el post al backend
    const postData = {
        username: activeUser,
        content: postContent,
        created_at: new Date().toISOString(),
    };

    console.log('Creando post:', postData);
    
    // Simulación de éxito
    addPostToUI(postData);
    document.getElementById('textpost').value = '';
    selectedFile = null;
    
    alert('¡Mate cebado! Tu post se ha publicado correctamente.');
}

function addPostToUI(postData) {
    const postsContainer = document.querySelector('.right-side');
    const newPost = document.createElement('div');
    newPost.className = 'postContainer';
    
    newPost.innerHTML = `
        <div class="authorContainer">
            <img class="avatarPost" src="res/default-avatar.svg" alt="Avatar">
            <span class="authorName">${postData.username}</span>
        </div>
        <span class="postText">${postData.content}</span>
        <div class="buttonsSec">
            <button class="post-button">
                <img src="res/react.svg" alt="">
                <span class="label-button-post">Reaccionar</span>
            </button>
        </div>
    `;
    
    // Insertar después del dialogPostContainer
    const dialogPost = document.querySelector('.dialogPostContainer');
    postsContainer.insertBefore(newPost, dialogPost.nextSibling);
}

// ===== SISTEMA DE TEMA =====
function toggleTheme() {
    const currentTheme = document.documentElement.getAttribute('data-theme');
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
    
    document.documentElement.setAttribute('data-theme', newTheme);
    localStorage.setItem('theme', newTheme);
}

// Cargar tema guardado
document.addEventListener('DOMContentLoaded', function() {
    const savedTheme = localStorage.getItem('theme') || 'dark';
    document.documentElement.setAttribute('data-theme', savedTheme);
});

// ===== EVENT LISTENERS =====
document.addEventListener('DOMContentLoaded', function() {
    // Botón de enviar post
    const sendButton = document.querySelector('.post-button-send');
    if (sendButton) {
        sendButton.addEventListener('click', createPost);
    }

    // Botón de retroceso en login
    const backButton = document.querySelector('.backButton');
    if (backButton) {
        backButton.addEventListener('click', goBackToWelcome);
    }

    // Botones de login
    const loginButtons = document.querySelectorAll('.loginButton');
    loginButtons.forEach(button => {
        if (button.textContent.includes('Tengo una cuenta')) {
            button.addEventListener('click', useExistingUser);
        } else {
            button.addEventListener('click', loginUser);
        }
    });

    // Input de archivos para posts
    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = 'image/*,audio/*,video/*';
    fileInput.style.display = 'none';
    fileInput.addEventListener('change', handleFileSelect);
    document.body.appendChild(fileInput);

    // Botón de imagen
    const imageButton = document.querySelector('.post-button');
    if (imageButton) {
        imageButton.addEventListener('click', () => fileInput.click());
    }
});

// ===== FUNCIONES DE UI =====
function toggleSidebar() {
    const sidebar = document.querySelector('.sidebar');
    sidebar.classList.toggle('minimized');
}

// Efectos hover mejorados
document.addEventListener('DOMContentLoaded', function() {
    // Agregar efectos a todos los botones de posts
    const postButtons = document.querySelectorAll('.post-button, .post-button-min');
    postButtons.forEach(button => {
        button.addEventListener('mouseenter', function() {
            this.style.transform = 'scale(1.05)';
            this.style.filter = 'brightness(1.4)';
        });
        
        button.addEventListener('mouseleave', function() {
            this.style.transform = 'scale(1)';
            this.style.filter = 'brightness(1)';
        });
        
        button.addEventListener('mousedown', function() {
            this.style.transform = 'scale(0.95)';
            this.style.filter = 'brightness(0.9)';
        });
        
        button.addEventListener('mouseup', function() {
            this.style.transform = 'scale(1.05)';
            this.style.filter = 'brightness(1.4)';
        });
    });
});