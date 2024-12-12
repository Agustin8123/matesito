let users = {};  // Objeto para almacenar los usuarios y contraseñas y sus imágenes de perfil
    let tweets = [];  // Usamos un arreglo para almacenar los tweets
    let activeUser = '';  // Variable para el usuario activo

    let mantenimiento = false;

    let selectedFile = null;

    let lastTweetContent = "";
    const forbiddenWords = ['⣿', 'droga', 'droja', 'dr0ga', 'drogu3', 'drogaa', 'merca', 'falopa', 'estupefaciente', 'sustancia', 'cocaína', 'kok4', 'c0ca', 'cocaína', 'nieve', 'marihuana', 'weed', 'hierba', 'porro', 'mota', 'cannabis', '4:20', 'maría', 'maryjane', 'hachís', 'thc', 'éxtasis', 'éxt4sis', 'xtc', 'mdma', 'éxtasis', 'lsd', 'ácido', 'trips', 'lsd', 'pornografía', 'porno', 'p0rn', 'p0rn0', 'xxx', 'material explícito', 'sexo', 's3xo', 'segso', 'prostitución', 'scort', 'trabajadora sexual', 'prostitut@', 'pr0stituc1on', 'prostituta', 'puta', 'pene', 'p3ne', 'pen3', 'genitales', 'vagina', 'vag1n4', 'pechos', 'senos', 'tetas', 't3t@s', 'd.r.o.g.a', 'dro@g@', 'DrOgA', 'dRoJA'];

    document.addEventListener("DOMContentLoaded", function() {
    updateUserButton();  // Llama a la función para cargar la imagen por defecto cuando la página se haya cargado
    document.getElementById('initialOverlay').style.display = 'none';
    });

    document.getElementById('acceptTermsCheckbox').addEventListener('change', function() {
    const createButton = document.getElementById('createUserButton');
    if (this.checked) {
        createButton.disabled = false; // Habilitar el botón si está marcado
    } else {
        createButton.disabled = true; // Deshabilitar el botón si no está marcado
    }
    });

window.onload = function() {
    document.getElementById('initialOverlay').style.display = 'none';
    document.getElementById('AvisoOverlay').style.display = 'flex';
    document.getElementById('appContainer').style.display = 'none';
    document.getElementById('usernameOverlay').style.display = 'none';
}

function verMant(valor) {
    if (valor === true) {
        window.location.href = 'mantenimiento.html';
    }
}

function Acept() {
    document.getElementById('initialOverlay').style.display = 'flex';
    document.getElementById('AvisoOverlay').style.display = 'none';
}

function toggleMenu() {
            const menu = document.getElementById('dropdownMenu');
            menu.style.display = menu.style.display === 'block' ? 'none' : 'block';
        }

function HelpAlert() {
    alert('Si requieres ayuda con cualquier cosa, contactate con nuestro correo de soporte "matesito.soporte@gmail.com"');
}


    function toggleSubMenu() {
        const subMenu = document.getElementById('subMenu');
        subMenu.style.display = subMenu.style.display === 'block' ? 'none' : 'block';
    }

function useExistingUser() {
    document.getElementById('initialOverlay').style.display = 'none';
    document.getElementById('usernameOverlay').style.display = 'flex';
}

function createNewUser() {
    document.getElementById('initialOverlay').style.display = 'none';
    document.getElementById('userSelectOverlay').style.display = 'flex';
    document.querySelector('.header button').style.display = 'none'; // Ocultar el botón de selección de usuario
}

function encodePassword(password) {
    return btoa(password); // Convierte a Base64
}

// Función para decodificar la contraseña de Base64
function decodePassword(encodedPassword) {
    return atob(encodedPassword);
}

// Guardar la sesión con cookies
function saveSession(username, password, rememberMe) {
    if (rememberMe) {
        // Guardar usuario y contraseña en cookies con encriptación
        document.cookie = `username=${username}; max-age=86400; path=/`;
        document.cookie = `password=${encodePassword(password)}; max-age=86400; path=/`;
    } else {
        // Eliminar cookies si no está marcada la opción "Recordar sesión"
        document.cookie = `username=; max-age=0; path=/`;
        document.cookie = `password=; max-age=0; path=/`;
    }
}

// Función de login
function loginUser() {
    const username = document.getElementById('usernameInput').value.trim();
    const password = document.getElementById('passwordInput').value.trim();
    const rememberMe = document.getElementById('rememberMe').checked;

    fetch('https://matesito.onrender.com/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
    })
    .then(response => response.json())
    .then(data => {
        if (data.username) {
            setActiveUser(data.username); // Función para actualizar el usuario activo
            saveSession(username, password, rememberMe); // Guardar sesión si "Recordar mi sesión" está marcado
        } else {
            alert('Error al iniciar sesión');
        }
    })
    .catch(error => {
        alert('Error de conexión');
    });
}

// Obtener cookies
function getCookie(name) {
    const value = `; ${document.cookie}`;
    const parts = value.split(`; ${name}=`);
    if (parts.length === 2) return parts.pop().split(';').shift();
}

// Verificar si el usuario está guardado en las cookies
function checkRememberedUser() {
    const username = getCookie('username');
    const encodedPassword = getCookie('password');
    if (username && encodedPassword) {
        // Completar los campos de inicio de sesión con valores decodificados
        document.getElementById('usernameInput').value = username;
        document.getElementById('passwordInput').value = decodePassword(encodedPassword);
        document.getElementById('rememberMe').checked = true;
    }
}

// Llamar a esta función al cargar la página
document.addEventListener('DOMContentLoaded', checkRememberedUser);

function HideOverlays(){
    document.getElementById('initialOverlay').style.display = 'none';
    document.getElementById('userSelectOverlay').style.display = 'none';
    document.getElementById('usernameOverlay').style.display = 'none'; 
}

function updateUserButton() {
    const userButton = document.querySelector('.header button');
    const userImage = users[activeUser] && users[activeUser].image ? users[activeUser].image : 'default-avatar.png'; // Ruta de una imagen predeterminada
    userButton.innerHTML = `<img src="${userImage}" alt="${activeUser}" class="profile-pic-img">`;
}

function setActiveUser(username) {
    fetch('https://matesito.onrender.com/getUserDetails', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username })
    })
    .then(response => response.json())
    .then(data => {
    console.log('Datos recibidos:', data);
    if (data.id) {
        activeUser = username;
        hideUserSelectOverlay();
        document.getElementById('appContainer').style.display = 'block';
        updateUserButton();
        HideOverlays();
    } else {
        alert("Usuario no encontrado.");
    }
})

    .catch(error => {
        alert("Error al obtener los detalles del usuario.");
    });
}

function showUserSelectOverlay() {
    document.getElementById('initialOverlay').style.display = 'flex';
}

function hideUserSelectOverlay() {
    document.getElementById('userSelectOverlay').style.display = 'none';
    document.querySelector('.header button').style.display = 'block'; // Mostrar el botón de selección de usuario nuevamente
}

function addNewUser() {

    const usernameInput = document.getElementById('newUsernameInput');
    const passwordInput = document.getElementById('newPasswordInput');
    const profileImageInput = document.getElementById('newProfileImage');
    const username = usernameInput.value.trim();
    const password = passwordInput.value.trim();

    if (username !== "" && password !== "") {
        let profileImage = 'default-avatar.png'; // Imagen predeterminada
        if (profileImageInput.files && profileImageInput.files[0]) {
            const reader = new FileReader();
            reader.onload = function(e) {
                profileImage = e.target.result;
                // Enviar los datos al servidor
                createUserInDatabase(username, password, profileImage);
            };
            reader.readAsDataURL(profileImageInput.files[0]);
        } else {
            // Enviar los datos al servidor
            createUserInDatabase(username, password, profileImage);
        }

        // Limpiar los campos después de intentar agregar el usuario
        usernameInput.value = '';
        passwordInput.value = '';
        document.querySelector('.header button').style.display = 'block'; // Mostrar el botón de selección de usuario nuevamente
    } else {
        alert('Por favor, introduce un nombre o apodo y contraseña válidos.');
    }
}

function createUserInDatabase(username, password, profileImage) {
    // Crear un objeto con los datos del nuevo usuario
    const userData = {
        username: username,
        password: password,
        profileImage: profileImage
    };

    // Hacer la solicitud POST al servidor
    fetch('https://matesito.onrender.com/users', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(userData)
    })
    .then(response => response.json())
    .then(data => {
        if (data.id) {
            // Si el usuario se crea correctamente, guarda al nuevo usuario como activo
            setActiveUser(username);
        } else {
            document.getElementById('initialOverlay').style.display = 'none';
            document.getElementById('userSelectOverlay').style.display = 'none';
            document.getElementById('usernameOverlay').style.display = 'flex';
            alert('Ya puedes iniciar sesión.'); 
        }
    })
    .catch(error => {
        console.error('Error al crear el usuario:', error);
        alert('Hubo un error al crear el usuario.');
    });
}

function containsForbiddenWords(message) {
        return forbiddenWords.some(word => message.toLowerCase().includes(word.toLowerCase()));
    }

    function handleFileSelect(event) {
        selectedFile = event.target.files[0]; // Guardar el archivo seleccionado
        if (selectedFile) {
            console.log("Archivo seleccionado:", selectedFile.name);
        } else {
            console.log("No se seleccionó ningún archivo");
        }
    }
    
    // Función para enviar el tweet
    function postTweet() {
        const tweetContent = document.getElementById('tweetContent').value;
    
        if (containsForbiddenWords(tweetContent)) {
            alert("Creemos que tu post infringe nuestros términos y condiciones. Si crees que es un error, contacta con soporte.");
            return;
        }
    
        if (tweetContent === lastTweetContent) {
            alert("No puedes enviar un post igual al anterior.");
            return;
        }
    
        const tweetData = {
            username: activeUser,
            content: tweetContent,
        };
    
        if (selectedFile) {
            // Subir el archivo a Cloudinary
            const formData = new FormData();
            formData.append("file", selectedFile);
            formData.append("upload_preset", "ml_default"); // Asegúrate de que el preset coincida con el configurado en tu cuenta
    
            fetch('https://api.cloudinary.com/v1_1/dtzl420mq/upload', {
                method: 'POST',
                body: formData,
            })
            .then(response => response.json())
            .then(data => {
                tweetData.media = data.secure_url; // URL del archivo subido
                tweetData.mediaType = selectedFile.type;
    
                // Enviar el tweet al servidor
                return fetch('https://matesito.onrender.com/tweets', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(tweetData),
                });
            })
            .then(response => response.json())
            .then(data => {
                lastTweetContent = data.content;
                addTweetToList(data.content, data.media, data.mediaType, activeUser);
            })
            .catch(error => {
                console.error('Error al subir el archivo o enviar el tweet:', error);
            });
        } else {
            // Enviar el tweet sin archivo adjunto
            fetch('https://matesito.onrender.com/tweets', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(tweetData),
            })
            .then(response => response.json())
            .then(data => {
                lastTweetContent = data.content;
                addTweetToList(data.content, '', '', activeUser);
            })
            .catch(error => {
                console.error('Error al enviar el tweet:', error);
            });
        }
    }
    

function goBackToInitial() {
    document.getElementById('usernameOverlay').style.display = 'none';
    document.getElementById('userSelectOverlay').style.display = 'none';

    document.getElementById('initialOverlay').style.display = 'flex';
}


function loadTweets() {
    fetch('https://matesito.onrender.com/tweets') // Solicita los tweets al servidor
        .then(response => {
            if (!response.ok) {
                throw new Error(`Error al cargar los tweets: ${response.status}`);
            }
            return response.json();
        })
        .then(tweets => {
            const tweetList = document.getElementById('tweetList');
            tweetList.innerHTML = ''; // Limpiar la lista existente

            // Validar y mostrar cada tweet en la página
            tweets.forEach(tweet => {
                const { content, media, mediaType, username } = tweet;
                if (content && username) { // Validar campos requeridos
                    addTweetToList(content, media, mediaType, username);
                } else {
                    console.warn('Tweet inválido omitido:', tweet);
                }
            });
        })
        .catch(error => {
            console.error('Error al cargar los tweets:', error);
        });
}


// Agregar un tweet a la lista
function addTweetToList(content, media, mediaType, username) {
    const tweetList = document.getElementById('tweetList');
    const newTweet = document.createElement('li');
    newTweet.className = 'tweet';

    let mediaHTML = '';
    if (media && mediaType) {
        if (mediaType.startsWith('image/')) {
            mediaHTML = `<div><img src="${media}" alt="Imagen subida por ${username}" class="preview-media"></div>`;
        } else if (mediaType.startsWith('video/')) {
            mediaHTML = `<div>
                            <video controls class="preview-media">
                                <source src="${media}" type="${mediaType}">
                                Tu navegador no soporta la reproducción de video.
                            </video>
                         </div>`;
        } else {
            console.warn('Tipo de medio no soportado:', mediaType);
        }
    }

    newTweet.innerHTML = `
        <span class="username">${username}:</span> ${content}
        ${mediaHTML}
    `;
    tweetList.insertBefore(newTweet, tweetList.firstChild);
}


// Llamar a loadTweets al cargar la página
window.onload = verMant(mantenimiento);
window.onload = checkRememberedUser();
window.onload = loadTweets();
window.onload = setInterval(loadTweets, 20000);