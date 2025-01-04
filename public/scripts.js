let users = {};  // Objeto para almacenar los usuarios y contraseñas y sus imágenes de perfil
    let posts = [];  // Usamos un arreglo para almacenar los posts
    let activeUser = '';  // Variable para el usuario activo

    let mantenimiento = false;

    let selectedFile = null;
    let loadAll = false;

    let lastpostContent = "";
    const forbiddenWords = ['⣿', 'droga', 'droja', 'dr0ga', 'drogu3', 'drogaa', 'merca', 'falopa', 'cocaína', 'kok4', 'c0ca', 'cocaína', 'marihuana', 'weed', 'hierba', 'porro', 'mota', 'cannabis', '4:20', 'maría', '420', 'hachís', 'thc', 'éxtasis', 'éxt4sis', 'xtc', 'mdma', 'éxtasis', 'lsd', 'ácido', 'trips', 'lsd', 'd.r.o.g.a', 'dro@g@', 'DrOgA', 'dRoJA'];

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

    function togglePassword() {
        const passwordInput = document.getElementById('newPasswordInput');
        const toggleButton = document.getElementById('togglePasswordButton');

        if (passwordInput.type === "password") {
            passwordInput.type = "text";
            toggleButton.innerHTML = '<img src="eyeOpen.png" alt="Ocultar Contraseña">';
        } else {
            passwordInput.type = "password";
            toggleButton.innerHTML = '<img src="eyeClose.png" alt="Ver Contraseña">';
        }
    }

    function togglePassword1() {
        const passwordInput = document.getElementById('passwordInput');
        const toggleButton = document.getElementById('togglePasswordBoton');

        if (passwordInput.type === "password") {
            passwordInput.type = "text";
            toggleButton.innerHTML = '<img src="eyeOpen.png" alt="Ocultar Contraseña">';
        } else {
            passwordInput.type = "password";
            toggleButton.innerHTML = '<img src="eyeClose.png" alt="Ver Contraseña">';
        }
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

    fetch('https://matesitotest.onrender.com/login', {
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
    const userButton = document.querySelector('#userButton');

    // Usar la imagen del usuario activo, o una predeterminada si no existe
    const userImage = users[activeUser] && users[activeUser].profileImage
        ? users[activeUser].profileImage
        : 'default-avatar.png'; // Imagen predeterminada

    // Configurar el botón con la imagen y el nombre del usuario
    userButton.innerHTML = `<img src="${userImage}" alt="${activeUser}" class="profile-pic-img">`;
}


function setActiveUser(username) {
    fetch('https://matesitotest.onrender.com/getUserDetails', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username }),
    })
    .then(response => response.json())
    .then(data => {
        console.log('Datos recibidos:', data);
        if (data.id) {
            // Guardar detalles del usuario activo
            activeUser = username;
            if (!users[username]) {
                users[username] = {}; // Asegurarse de que el usuario exista en la estructura
            }

            // Guardar el ID del usuario
            users[username].id = data.id;

            // Guardar la imagen de perfil (o usar una por defecto)
            users[username].profileImage = data.profileImage || 'default-avatar.png'; 

            // Actualizar la UI
            hideUserSelectOverlay();
            document.getElementById('appContainer').style.display = 'block';
            updateUserButton();
            HideOverlays();
        } else {
            alert("Usuario no encontrado.");
        }
    })
    .catch(error => {
        console.error("Error al obtener los detalles del usuario:", error);
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

    if (!username || !password) {
        alert('Por favor, introduce un nombre o apodo y contraseña válidos.');
        return;
    }

    if (!document.getElementById('acceptTermsCheckbox').checked) {
        alert('Debes aceptar los términos y condiciones para continuar.');
        return;
    }

    let profileImageURL = 'default-avatar.png'; // Imagen predeterminada

    if (profileImageInput.files && profileImageInput.files[0]) {
        const formData = new FormData();
        formData.append('file', profileImageInput.files[0]);
        formData.append('upload_preset', 'matesito'); // Cambia esto por tu preset en Cloudinary

        fetch('https://api.cloudinary.com/v1_1/dtzl420mq/upload', {
            method: 'POST',
            body: formData,
        })
        .then(response => response.json())
        .then(data => {
            profileImageURL = data.secure_url; // URL de la imagen subida
            createUserInDatabase(username, password, profileImageURL);
        })
        .catch(error => {
            console.error('Error al subir la imagen:', error);
            alert('No se pudo subir la imagen de perfil. Inténtalo de nuevo.');
        });
    } else {
        createUserInDatabase(username, password, profileImageURL);
    }

    usernameInput.value = '';
    passwordInput.value = '';
    profileImageInput.value = ''; // Deseleccionar el archivo
}

function createUserInDatabase(username, password, profileImageURL) {
    const userData = {
        username,
        password,
        profileImage: profileImageURL,
    };

    fetch('https://matesitotest.onrender.com/users', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(userData),
    })
    .then(response => response.json())
    .then(data => {
        if (data.id) {
            setActiveUser(username); // Establecer al nuevo usuario como activo
        } else {
            alert('error al crear el usuario');
        }
    })
    .catch(error => {
        console.error('Error al crear el usuario:', error);
        alert('Hubo un error al crear el usuario.');
    });
}

function createForum() {
    const forumName = document.getElementById('forumName').value;
    const forumDescription = document.getElementById('forumDescription').value;
    const ownerId = users[activeUser].id;

    // Validación simple
    if (!forumName || !forumDescription || !ownerId) {
        alert("Por favor, completa todos los campos.");
        return;
    }

    // Crear el objeto de datos a enviar
    const forumData = {
        name: forumName,
        description: forumDescription,
        ownerId: parseInt(ownerId),  // Asegurarse de que el ID sea un número
    };

    // Enviar la solicitud al backend
    fetch('https://matesitotest.onrender.com/foros', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(forumData),
    })
    .then(response => {
        if (!response.ok) {
            throw new Error('Error al crear el foro');
        }
        return response.json();
    })
    .then(data => {
        // Mostrar un mensaje de éxito y cerrar el overlay
        alert(`Foro creado exitosamente: ${data.name}`);
        createForumMenu();  // Cerrar el overlay
    })
    .catch(error => {
        // Mostrar un mensaje de error
        alert(`Error: ${error.message}`);
    });
}

// Esta función carga los foros y los muestra en la página
function loadForos() {
    fetch('/foros')
        .then(response => response.json())
        .then(foros => {
            const container = document.getElementById('forosContainer');
            container.innerHTML = ''; // Limpiamos el contenedor antes de renderizar

            if (foros.length === 0) {
                // Si no hay foros, mostramos un mensaje
                const noForosMessage = document.createElement('p');
                noForosMessage.textContent = 'No hay nada aquí';
                noForosMessage.style.textAlign = 'center'; // Opcional, para centrar el texto
                noForosMessage.style.color = 'gray'; // Opcional, para estilizar el texto
                container.appendChild(noForosMessage);
            } else {
                // Si hay foros, los iteramos y renderizamos
                foros.forEach(foro => {
                    const foroElement = document.createElement('div');
                    foroElement.classList.add('user'); // Agregar una clase para estilizar

                    // Creamos la estructura del foro (nombre, descripción y botón para unirse)
                    foroElement.innerHTML = `
                    <label for="${foro.id}${foro.name}" class="boton">${foro.name}</label>
                    <input type="radio" id="${foro.id}${foro.name}" name="nav" style="display:none;" onclick="toggle_ForumMenu('${foro.name}')">
                        <div id="${foro.name}" class="dropdown-menu" style=" position: fixed; left: 367px; top: 66px;">
                        <h2 style="margin-top: -5px;">${foro.name}</h2>
                        <p style="margin-top: -10px;">${foro.description}</p>
                            <label for="${foro.name}${foro.id}" class="boton">Ver Foro</label>
                                <input type="radio" id="${foro.name}${foro.id}}" name="nav" style="display:none;" onclick="viewForum('${foro.id}')">

                            <label for="${foro.id}${foro.name}${foro.id}" class="boton">Seguir foro</label>
                                <input type="radio" id="${foro.id}${foro.name}${foro.id}" name="nav" style="display:none;" onclick="joinForum(${foro.id})">

                            <label for="${foro.id}" class="botonV">Volver</label>
                                <input type="radio" id="${foro.id}" name="nav" style="display:none;" onclick="toggle_ForumMenu('${foro.name}')">
                        </div>
                    `;

                    // Agregamos el foro al contenedor
                    container.appendChild(foroElement);
                });
            }
        })
        .catch(error => {
            console.error('Error al cargar los foros:', error);

            const container = document.getElementById('forosContainer');
            container.innerHTML = ''; // Limpiamos el contenedor antes de renderizar

            // Mostramos un mensaje indicando que no hay foros (por error)
            const noForosMessage = document.createElement('p');
            noForosMessage.textContent = 'No hay nada aquí';
            noForosMessage.style.textAlign = 'center'; // Opcional, para centrar el texto
            noForosMessage.style.color = 'gray'; // Opcional, para estilizar el texto
            container.appendChild(noForosMessage);
            alert("Error al cargar los foros")
        });
}

function joinForum(forumId) {
    // Asegúrate de que 'users.id' esté correctamente definido en tu aplicación
    const data = {
        userId: users[activeUser].id, // ID del usuario activo
        forumId: forumId  // ID del foro que se pasa como parámetro
    };

    fetch('https://matesitotest.onrender.com/joinForum', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(data)
    })
    .then(response => response.json())
    .then(data => {
        if (data.message) {
            alert(data.message); // Muestra el mensaje recibido desde el backend
        } else {
            alert('Error desconocido al procesar la solicitud'); // Mensaje por defecto si no hay mensaje
        }
    })
    .catch((error) => {
        console.error('Error:', error);
        alert('Error al procesar la solicitud'); // Mensaje de error general
    });
}

function leaveForum(forumId) {
    // Asegúrate de que 'users.id' esté correctamente definido en tu aplicación
    const data = {
        userId: users[activeUser].id, // ID del usuario activo
        forumId: forumId  // ID del foro que se pasa como parámetro
    };

    fetch('https://matesitotest.onrender.com/leaveForum', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(data)
    })
    .then(response => response.json())
    .then(data => {
        if (data.message) {
            alert(data.message); // Muestra el mensaje recibido desde el backend
        } else {
            alert('Error desconocido al procesar la solicitud'); // Mensaje por defecto si no hay mensaje
        }
    })
    .catch((error) => {
        console.error('Error:', error);
        alert('Error al procesar la solicitud'); // Mensaje de error general
    });
}


function loadUserForums() {
    const userId = users[activeUser].id;

    fetch(`https://matesitotest.onrender.com/userForums/${userId}`)
        .then(response => response.json())
        .then(forums => {
            const container = document.getElementById('forosContainer2'); // Contenedor para los foros unidos
            container.innerHTML = ''; // Limpiamos el contenedor

            if (forums.length === 0) {
                // Si no hay foros, mostramos un mensaje
                const noForumsMessage = document.createElement('p');
                noForumsMessage.textContent = 'No hay foros a los que estés unido';
                noForumsMessage.style.textAlign = 'center';
                noForumsMessage.style.color = 'gray';
                container.appendChild(noForumsMessage);
            } else {
                // Renderizamos los foros
                forums.forEach(foro => {
                    const forumElement = document.createElement('div');
                    forumElement.classList.add('user');

                    forumElement.innerHTML = `
                        <label for="${foro.id}${foro.name}" class="boton">${foro.name}</label>
                    <input type="radio" id="${foro.id}${foro.name}" name="nav" style="display:none;" onclick="toggle_ForumMenu('${foro.name}')">
                        <div id="${foro.name}" class="dropdown-menu" style=" position: fixed; left: 367px; top: 66px;">
                        <h2 style="margin-top: -5px;">${foro.name}</h2>
                        <p style="margin-top: -10px;">${foro.description}</p>
                            <label for="${foro.name}${foro.id}" class="boton">Ver Foro</label>
                                <input type="radio" id="${foro.name}${foro.id}}" name="nav" style="display:none;" onclick="viewForum('${foro.id}')">

                            <label for="${foro.id}${foro.name}${foro.id}" class="boton">Dejar de seguir foro</label>
                                <input type="radio" id="${foro.id}${foro.name}${foro.id}" name="nav" style="display:none;" onclick="leaveForum(${foro.id})">

                            <label for="${foro.id}" class="botonV">Volver</label>
                                <input type="radio" id="${foro.id}" name="nav" style="display:none;" onclick="toggle_ForumMenu('${foro.name}')">
                        </div>
                    `;

                    container.appendChild(forumElement);
                });
            }
        })
        .catch(error => {
            console.error('Error al cargar los foros del usuario:', error);
            alert('Error al cargar los foros del usuario');
        });
}


function containsForbiddenWords(message) {
        return forbiddenWords.some(word => message.toLowerCase().includes(word.toLowerCase()));
    }

    function handleFileSelect(event) {
        selectedFile = event.target.files[0]; // Guardar el archivo seleccionado
        if (selectedFile) {
            const fileType = selectedFile.type;
            const fileSize = selectedFile.size;

            // Validar tipo de archivo
            const validFileTypes = ['image', 'audio', 'video'];
            const fileCategory = fileType.split('/')[0];

            if (!validFileTypes.includes(fileCategory)) {
                alert("Por favor, selecciona un archivo de tipo imagen, audio o video.");
                selectedFile = null;
                event.target.value = ''; // Restablecer la selección
                return;
            }

            // Validar tamaño de archivo
            if (
                (fileCategory === 'image' || fileCategory === 'audio') && fileSize > 6 * 1024 * 1024 ||
                fileCategory === 'video' && fileSize > 10 * 1024 * 1024
            ) {
                alert("El archivo seleccionado excede el tamaño máximo permitido.");
                selectedFile = null;
                event.target.value = ''; // Restablecer la selección
                return;
            }

            console.log("Archivo válido seleccionado:", selectedFile.name);
        } else {
            console.log("No se seleccionó ningún archivo");
        }
    }

    function postpost() {
        const postContent = document.getElementById('postContent').value;
        const isSensitive = document.getElementById('sensitiveContentCheckbox').checked;

        if (containsForbiddenWords(postContent)) {
            alert("Creemos que tu post infringe nuestros términos y condiciones. Si crees que es un error, contacta con soporte.");
            return;
        }

        if (postContent === lastpostContent) {
            alert("No puedes enviar un post igual al anterior.");
            return;
        }

        const postData = {
            username: activeUser,
            content: postContent,
            sensitive: isSensitive ? 1 : 0,
            createdAt: new Date().toISOString(), // Hora en formato UTC
        };

        // Mostrar el símbolo de carga
        document.getElementById('loading').style.display = 'block';

        if (selectedFile) {
            const formData = new FormData();
            formData.append("file", selectedFile);
            formData.append("upload_preset", "matesito");

            fetch('https://api.cloudinary.com/v1_1/dtzl420mq/upload', {
                method: 'POST',
                body: formData,
            })
            .then(response => response.json())
            .then(data => {
                postData.media = data.secure_url;
                postData.mediaType = selectedFile.type;

                return fetch('https://matesitotest.onrender.com/posts', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(postData),
                });
            })
            .then(response => response.json())
            .then(data => {
                lastpostContent = data.content;
                addpostToList(data.content, data.media, data.mediaType, activeUser);
                document.getElementById('postMedia').value = '';
                selectedFile = null;
                document.getElementById('loading').style.display = 'none';
                alert('Tu post se ha enviado correctamente');
                loadposts();togglePosts();
            })
            .catch(error => {
                console.error('Error al subir el archivo o enviar el post:', error);
                alert('Error al subir el archivo o enviar el post');
            })

        } else {
            fetch('https://matesitotest.onrender.com/posts', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(postData),
            })
            .then(response => response.json())
            .then(data => {
                lastpostContent = data.content;
                addpostToList(data.content, null, null, activeUser);
                alert('Tu post se ha enviado correctamente');
                loadposts();togglePosts();
            })
            .catch(error => {
                console.error('Error al enviar el post:', error);
                alert('Error al enviar el post');
            })
            .finally(() => {
                // Ocultar el símbolo de carga
                document.getElementById('loading').style.display = 'none';
            });
        }
    }    

function goBackToInitial() {
    document.getElementById('usernameOverlay').style.display = 'none';
    document.getElementById('userSelectOverlay').style.display = 'none';

    document.getElementById('initialOverlay').style.display = 'flex';
}

let showSensitiveContent = false;

function buttonsState() {
    // Obtener referencias a los contenedores directamente dentro de la función
    const profileList = document.getElementById('profileList');
    const postList = document.getElementById('postList');

    if (profileList.style.display === 'block') {
        const username = document.getElementById('currentProfileUsername').value; // Obtener el username actual
        viewProfile(username, loadAll); // Llamar a viewProfile con el estado de loadAll
    } else if (postList.style.display === 'block') {
        loadposts(loadAll); // Llamar a loadposts con el estado de loadAll
    }
}

// Función para alternar la configuración de contenido sensible
function toggleSensitiveContent() {
    showSensitiveContent = !showSensitiveContent;

    const toggleButton = document.getElementById('toggleButton');

    // Actualiza el texto del botón
    toggleButton.textContent = showSensitiveContent
        ? 'Ocultar contenido sensible'
        : 'Mostrar contenido sensible';

    // Llamar a buttonsState para recargar los posts según el estado actual
    buttonsState();

    console.log(showSensitiveContent);
}

function togglePostLoad() {
    loadAll = !loadAll; // Alternar estado
    const button = document.getElementById('loadAllPostsButton');

    // Cambiar texto del botón basado en el estado
    button.textContent = loadAll ? 'Mostrar solo los últimos 12 posts' : 'Cargar todos los posts';

    // Llamar a buttonsState para recargar los posts según el estado actual
    buttonsState();
}


// Función para cargar los posts
// Función para cargar los posts
function loadposts(loadAll) {

    console.log("Cargando posts...");
    fetch('https://matesitotest.onrender.com/posts')
        .then(response => {
            if (!response.ok) {
                throw new Error(`Error al cargar los posts: ${response.status}`);
            }
            return response.json();
        })
        .then(posts => {
            const reversedPosts = posts;

            // Determinar cuántos posts renderizar
            const postsToRender = loadAll ? reversedPosts : reversedPosts.slice(0, 12);

            // Limpiar la lista y renderizar los posts seleccionados
            postList.innerHTML = '';
            postsToRender.forEach(post => {
                const { content, media, mediaType, username, profilePicture, sensitive, createdAt, userId } = post;

                // Filtrar contenido sensible correctamente
                if (!showSensitiveContent && sensitive === true) return;

                if (content && username) {
                    addpostToList(content, media, mediaType, username, profilePicture, sensitive, createdAt, userId, 'postList');
                } else {
                    console.warn('Post inválido omitido:', post);
                }
            });
        })
        .catch(error => {
            console.error('Error al cargar los posts:', error);
        });
}

// Agregar un post a la lista
function addpostToList(content, media, mediaType, username, profilePicture, sensitive, createdAt, userId, listId) {
    // Seleccionar la lista donde se insertará el post usando listId
    const postList = document.getElementById(listId);
    if (!postList) {
        console.error(`No se encontró el contenedor con id "${listId}".`);
        return;
    }

    const newpost = document.createElement('li');
    newpost.className = 'post';

    // Convertir fecha a hora local
    const localTime = createdAt ? new Date(createdAt).toLocaleString() : '';

    // Imagen del perfil
    const profilePicHTML = profilePicture
        ? `<img src="${profilePicture}" alt="Foto de perfil de ${username}" class="profile-picture">`
        : `<img src="/default-profile.png" alt="Foto de perfil por defecto" class="profile-picture">`;

    // Media del post (imagen/video/audio)
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
        } else if (mediaType.startsWith('audio/')) {
            mediaHTML = `<div>
                            <audio controls class="preview-media">
                                <source src="${media}" type="${mediaType}">
                                Tu navegador no soporta la reproducción de audio.
                            </audio>
                         </div>`;
        }
    }

    // Contenido sensible
    let contentHTML = sensitive === true
        ? `<div class="sensitive-content">
                <p>⚠ Este contenido ha sido marcado como sensible</p>
                <button onclick="this.nextElementSibling.style.display='block'; this.style.display='none';">Mostrar contenido</button>
                <div class="hidden-content" style="display:none;">
                    ${content}
                    ${mediaHTML}
                </div>
           </div>`
        : `<div class="post-content">${content}${mediaHTML}</div>`;

    // Crear un id único para la caja de usuario
    const uniqueId = `userProfileBox_${userId}_${Math.random().toString(36).substr(2, 9)}`;

    // HTML del post
    newpost.innerHTML = `
        <div class="post-header">
            ${profilePicHTML}
            <span class="username" onclick="toggleUserProfileBox('${uniqueId}')">${username}:</span>
        </div>
        ${contentHTML}
        <div class="post-footer">
            <span class="post-time">${localTime}</span>
        </div>
        <div class="user-profile-box" id="${uniqueId}" style="display:none;">
            <button onclick="viewProfile('${username}')">Ver perfil</button>
            <button onclick="followUser(${userId})">Seguir</button>
        </div>
    `;

    postList.insertBefore(newpost, postList.firstChild);
}

// Mostrar u ocultar el cuadro de perfil cuando se hace clic en el nombre de usuario
function toggleUserProfileBox(uniqueId) {
    // Ocultar todas las cajas de perfil
    const allProfileBoxes = document.querySelectorAll('.user-profile-box');
    allProfileBoxes.forEach(box => box.style.display = 'none');

    // Mostrar u ocultar la caja correspondiente
    const userProfileBox = document.getElementById(uniqueId);
    if (userProfileBox) {
        userProfileBox.style.display = userProfileBox.style.display === 'none' ? 'block' : 'none';
    }
}

// Función para ver el perfil del usuario (puedes redirigir a una página de perfil)
function viewProfile(username, loadAll) {
    // Obtener referencias a los contenedores
    const profileList = document.getElementById('profileList');
    const postList = document.getElementById('postList');

    // Guardar el username actual en un input oculto
    let currentProfileUsername = document.getElementById('currentProfileUsername');
    if (!currentProfileUsername) {
        currentProfileUsername = document.createElement('input');
        currentProfileUsername.type = 'hidden';
        currentProfileUsername.id = 'currentProfileUsername';
        document.body.appendChild(currentProfileUsername);
    }
    currentProfileUsername.value = username;

    // Limpiar el contenido de la lista de perfil
    profileList.innerHTML = '';

    // Mostrar el contenedor de perfil y ocultar el de publicaciones
    profileList.style.display = 'block';
    postList.style.display = 'none';

    console.log("Cargando posts de", username);

    // Cargar los posts del usuario
    fetch(`https://matesitotest.onrender.com/posts/user/${username}`)
        .then(response => {
            if (!response.ok) {
                throw new Error(`Error al cargar los posts del usuario ${username}`);
            }
            return response.json();
        })
        .then(posts => {
            const postsToRender = loadAll ? posts : posts.slice(0, 12);

            postsToRender.forEach(post => {
                const { content, media, mediaType, username, profilePicture, sensitive, createdAt, userId } = post;
                // Filtrar contenido sensible si es necesario
                if (!showSensitiveContent && sensitive === true) return;
                if (content && username) {
                    addpostToList(content, media, mediaType, username, profilePicture, sensitive, createdAt, userId, 'profileList');
                }
            });
        })
        .catch(error => {
            console.error("Error al cargar los posts del usuario:", error);
        });
}

// Función para seguir al usuario
function followUser(userId) {
    const followerId = users[activeUser].id; // El ID del usuario que está siguiendo

    if (!followerId) {
        alert('Error: Usuario activo no encontrado');
        return;
    }

    fetch('https://matesitotest.onrender.com/followUser', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ followerId, followedId: userId })
    })
    .then(response => {
        return response.json().then(data => {
            if (!response.ok) {
                throw new Error(data.message || 'Error desconocido');
            }
            return data;
        });
    })
    .then(data => {
        alert(data.message); // Mensaje del backend
    })
    .catch(error => {
        console.error('Error al seguir al usuario:', error);
        alert(error.message || 'Error al seguir al usuario');
    });
}

function unfollowUser(followerId, followedId) {
    fetch('https://matesitotest.onrender.com/unfollowUser', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ followerId, followedId })
    })
    .then(response => response.json())
    .then(data => {
        if (data.message === 'Has dejado de seguir a este usuario') {
            alert('Has dejado de seguir a este usuario');
        } else {
            alert(data.message);
        }
    })
    .catch(error => {
        console.error('Error al dejar de seguir:', error);
        alert('Error al dejar de seguir al usuario');
    });
}

function loadFollowedUsers() {
    const followerId = users[activeUser]?.id; // ID del usuario activo

    fetch(`https://matesitotest.onrender.com/followedUsers/${followerId}`)
        .then(response => response.json())
        .then(users => {
            const container = document.getElementById('usersContainer');
            container.innerHTML = ''; // Limpiamos el contenedor

            if (users.length === 0) {
                // Si no hay usuarios seguidos, mostramos un mensaje
                const noUsersMessage = document.createElement('p');
                noUsersMessage.textContent = 'No sigues a ningún usuario';
                noUsersMessage.style.textAlign = 'center';
                noUsersMessage.style.color = 'gray';
                container.appendChild(noUsersMessage);
            } else {
                // Renderizamos los usuarios seguidos
                users.forEach(user => {
                    const userElement = document.createElement('div');
                    userElement.classList.add('user');

                    const Id = user.id;
                    const username = user.username;

                    userElement.innerHTML = `
                    <label for="${username}" class="boton">${user.username}</label>
                        <input type="radio" id="${username}" name="nav" style="display:none;" onclick="toggle_UserMenu(${Id})">
                        <div id="${Id}" class="dropdown-menu" style=" position: fixed; left: 367px; top: 66px;">
                            <label for="${username}${Id}" class="boton">Ver perfil</label>
                                <input type="radio" id="${username}${Id}" name="nav" style="display:none;" onclick="viewProfile('${username}')">
                            <label for="${Id}${username}${Id}" class="boton">Dejar de seguir</label>
                                <input type="radio" id="${Id}${username}${Id}" name="nav" style="display:none;" onclick="unfollowUser(${followerId}, ${Id})">

                            <label for="${Id}${username}" class="botonV">Volver</label>
                                <input type="radio" id="${Id}${username}" name="nav" style="display:none;" onclick="toggle_UserMenu(${Id})">
                        </div>
                    `;

                    container.appendChild(userElement);
                });
            }
        })
        .catch(error => {
            console.error('Error al cargar los usuarios seguidos:', error);
            alert('Error al cargar los usuarios seguidos');
        });
}

function searchMotor() {
    const query = document.getElementById('searchInput').value;
    const searchContainer = document.getElementById('searchconteiner');

    // Si el campo está vacío, limpiar y salir
    if (query.trim().length < 1) { 
        searchContainer.innerHTML = ''; // Limpiar resultados
        return; // Detener la ejecución
    }

    fetch(`/search?query=${query}`)
        .then(response => response.json())
        .then(data => {
            searchContainer.innerHTML = ''; // Limpiar resultados previos

            if (data.foros.length === 0 && data.usuarios.length === 0) {
                searchContainer.innerHTML = '<p>No se encontraron resultados.</p>';
            }

            // Mostrar foros
            data.foros.forEach(foro => {
                const foroElement = document.createElement('div');
                foroElement.classList.add('SearchContainer', 'forum-item'); // Agregar clases
                foroElement.innerHTML = `
                    <p><strong>Foro:</strong> ${foro.name}</p>
                `;
                // Agregar manejador de clic para el foro
                foroElement.addEventListener('click', () => {
                    viewForum(foro.id); // Llamar a la función con el ID del foro
                });
                searchContainer.appendChild(foroElement);
            });

            // Mostrar usuarios
            data.usuarios.forEach(user => {
                const userElement = document.createElement('div');
                userElement.classList.add('SearchContainer'); // Agregar clase
                userElement.innerHTML = `
                    <div class="SearchContainer user-item" style="margin-top: 5px; margin-bottom: 5px;">
                        <img src="${user.profilePicture || '/default-avatar.png'}" alt="${user.username}" class="profile-picture" />
                        <span class="username">${user.username}</span>
                    </div>
                `;
                // Agregar manejador de clic para el usuario
                userElement.addEventListener('click', () => {
                    viewProfile(user.username); // Llamar a la función con el nombre de usuario
                });
                searchContainer.appendChild(userElement);
            });
        })
        .catch(error => {
            console.error('Error al buscar:', error);
            alert('Error al procesar la búsqueda');
        });
    }


// Llamar a loadposts al cargar    página
window.onload = verMant(mantenimiento);
window.onload = checkRememberedUser();
window.onload = loadposts();