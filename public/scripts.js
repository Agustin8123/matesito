let users = {};  // Objeto para almacenar los usuarios y contraseñas y sus imágenes de perfil
    let posts = [];  // Usamos un arreglo para almacenar los posts
    let activeUser = '';  // Variable para el usuario activo

    let mantenimiento = false;

    let selectedFile = null;
    let loadAll = false;

    let lastpostContent = "";
    const forbiddenWords = ['⣿', 'droga', 'droja', 'dr0ga', 'drogu3', 'drogaa', 'merca', 'falopa', 'cocaína', 'kok4', 'c0ca', 'cocaína', 'marihuana', 'weed', 'hierba', 'porro', 'mota', 'cannabis', '4:20', 'maría', '420', 'hachís', 'thc', 'éxtasis', 'éxt4sis', 'xtc', 'mdma', 'éxtasis', 'lsd', 'ácido', 'trips', 'lsd', 'pornografía', 'd.r.o.g.a', 'dro@g@', 'DrOgA', 'dRoJA'];

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
                    foroElement.classList.add('foro'); // Agregar una clase para estilizar

                    // Creamos la estructura del foro (nombre, descripción y botón para unirse)
                    foroElement.innerHTML = `
                        <h2>${foro.name}</h2>
                        <p>${foro.description}</p>
                        <button id="joinForumButton_${foro.id}" onclick="joinForum(${foro.id})">Unirse al Foro</button>
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
        userId: users.id, // ID del usuario activo
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
            alert(data.message); // Muestra un mensaje de éxito
            const button = document.getElementById(`joinForumButton_${forumId}`);
            button.disabled = true; // Deshabilita el botón para evitar unirse múltiples veces
            button.innerText = 'Unido al Foro'; // Cambia el texto del botón
        } else {
            alert('Error al unirse al foro');
        }
    })
    .catch((error) => {
        console.error('Error:', error);
        alert('Error al procesar la solicitud');
    });
}

function loadUserForums() {
    const userId = users.id;

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
                forums.forEach(forum => {
                    const forumElement = document.createElement('div');
                    forumElement.classList.add('foro');

                    forumElement.innerHTML = `
                        <h2>${forum.name}</h2>
                        <p>${forum.description}</p>
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
                loadposts();
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
                loadposts();
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

// Función para alternar la configuración de contenido sensible
function toggleSensitiveContent() {
    showSensitiveContent = !showSensitiveContent;

    const toggleButton = document.getElementById('toggleButton');

    // Actualiza el texto del botón
    toggleButton.textContent = showSensitiveContent
        ? 'Ocultar contenido sensible'
        : 'Mostrar contenido sensible';

    // Recargar los posts con el filtro actualizado
    loadposts();
    console.log(showSensitiveContent);
}

function togglePostLoad() {
    loadAll = !loadAll; // Alternar estado
    const button = document.getElementById('loadAllPostsButton');
    
    // Cambiar texto del botón basado en el estado
    button.textContent = loadAll ? 'Mostrar solo los últimos 12 posts' : 'Cargar todos los posts';

    // Llamar a la función de carga con el nuevo estado
    loadposts(loadAll);
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
            const postList = document.getElementById('postList');
            // Invertir el array para que los más recientes estén primero
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
                    addpostToList(content, media, mediaType, username, profilePicture, sensitive, createdAt, userId);
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
function addpostToList(content, media, mediaType, username, profilePicture, sensitive, createdAt, userId) {
    const postList = document.getElementById('postList');
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

    // HTML del post
    newpost.innerHTML = `
        <div class="post-header">
            ${profilePicHTML}
            <span class="username" onclick="toggleUserProfileBox(event, '${username}', ${userId})">${username}:</span>
        </div>
        ${contentHTML}
        <div class="post-footer">
            <span class="post-time">${localTime}</span>
        </div>
        <div class="user-profile-box" id="userProfileBox_${username}" style="display:none;">
            <button onclick="viewProfile('${username}')">Ver perfil</button>
            <button onclick="followUser(${userId})">Seguir</button>
        </div>
    `;

    postList.insertBefore(newpost, postList.firstChild);
}


// Mostrar u ocultar el cuadro de perfil cuando se hace clic en el nombre de usuario
function toggleUserProfileBox(event, username) {
    const profileBox = document.getElementById(`userProfileBox_${username}`);
    const isVisible = profileBox.style.display === 'block';

    // Ocultar todos los cuadros de perfil
    const allProfileBoxes = document.querySelectorAll('.user-profile-box');
    allProfileBoxes.forEach(box => box.style.display = 'none');

    // Si el cuadro estaba oculto, mostrarlo
    if (!isVisible) {
        profileBox.style.display = 'block';
    }
}

// Función para ver el perfil del usuario (puedes redirigir a una página de perfil)
function viewProfile(username) {
    // Limpiar los posts actuales
    const postList = document.getElementById('postList');
    postList.innerHTML = '';

    // Mostrar el contenedor de posts (si estaba oculto)
    document.getElementById('appContainer').style.display = 'block';

    // Cargar los posts del usuario
    fetch(`https://matesitotest.onrender.com/posts/user/${username}`)
        .then(response => {
            if (!response.ok) {
                throw new Error(`Error al cargar los posts del usuario ${username}`);
            }
            return response.json();
        })
        .then(posts => {
            posts.forEach(post => {
                const { content, media, mediaType, username, profilePicture, sensitive, createdAt } = post;
                // Filtrar contenido sensible
                if (!showSensitiveContent && sensitive === true) return;
                if (content && username) {
                    addpostToList(content, media, mediaType, username, profilePicture, sensitive, createdAt);
                }
            });
        })
        .catch(error => {
            console.error("Error al cargar los posts del usuario:", error);
        });
}


// Función para seguir al usuario
function followUser(userId) {
    const followerId = users[activeUser].id;  // El ID del usuario que está siguiendo

    fetch('https://matesitotest.onrender.com/followUser', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ followerId, followedId: userId })
    })
    .then(response => response.json())
    .then(data => {
        console.log(data.message);
        alert(data.message); // Mensaje de éxito
    })
    .catch(error => {
        console.error('Error al seguir al usuario:', error);
        alert('Error al seguir al usuario');
    });
}

function loadFollowedUsers() {
    const followerId = users.id; // ID del usuario activo

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

                    userElement.innerHTML = `
                        <h3>${user.name}</h3>
                        <p>${user.email}</p>
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

// Llamar a loadposts al cargar la página
window.onload = verMant(mantenimiento);
window.onload = checkRememberedUser();
window.onload = loadposts();