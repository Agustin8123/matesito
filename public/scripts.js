    let users = {};  // Objeto para almacenar los usuarios y contrase
    let activeUser = '';  // Variable para el usuario activo
    let activeForum = '';
    let activeChat = '';
    let activeGroup = '';
    
    const forumList = 'forumList';
    const postList = 'postList';
    const messageList = 'messageList';
    const groupMessageList = 'groupMessageList';
    const profileList = 'profileList';
    const unicPostList = 'unicPostList';  

    let mantenimiento = false;

    let selectedFile = null;
    let loadAll = false;

    (function() {
        function toggleVisibility(elementId, displayType = 'block') {
                console.log("interactuando con: ", elementId);
                const element = document.getElementById(elementId);
                element.style.display = element.style.display === displayType ? 'none' : displayType;
            }
    
        // Función para ocultar múltiples menús
        function hideMenus(...menuIds) {
            console.log("interactuando con: ", menuIds);
            menuIds.forEach(menuId => {
                const menu = document.getElementById(menuId);
                if (menu && menu.style.display !== 'none') {
                    menu.style.display = 'none';
                }
            });
        }

        window.toggleVisibility = toggleVisibility;
        window.hideMenus = hideMenus;

    })();
    
    
      function showOnlyMenu(menuIdToShow, ...allMenuIds) {
        hideMenus(...allMenuIds);
        console.log("ocultando: ", allMenuIds);
    
        console.log("mostrando: ", menuIdToShow);
        toggleVisibility(menuIdToShow, 'block');
    }
    

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
            loadPosts(loadAll);
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

    // Validar longitud del nombre de usuario
    if (username.length > 25) {
        alert('El nombre de usuario no puede tener más de 30 caracteres.');
        return;
    }

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
    const forumName = document.getElementById('forumName').value.trim();
    const forumDescription = document.getElementById('forumDescription').value.trim();
    const ownerId = users[activeUser].id;

    // Validar longitud del nombre del foro
    if (forumName.length > 30) {
        alert('El nombre del foro no puede tener más de 30 caracteres.');
        return;
    }

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

  function createGroup() {
    const groupName = document.getElementById('groupName').value.trim();
    const groupDescription = document.getElementById('groupDescription').value.trim();
    const ownerId = users[activeUser].id;

    // Validar longitud del nombre del grupo
    if (groupName.length > 30) {
        alert('El nombre del grupo no puede tener más de 30 caracteres.');
        return;
    }

    // Validar que todos los campos estén completos
    if (!groupName || !groupDescription || !ownerId) {
        alert("Por favor, completa todos los campos.");
        return;
    }

    // Crear el objeto de datos para enviar al backend
    const groupData = {
        name: groupName,
        description: groupDescription,
        ownerId: parseInt(ownerId),
    };

    // Enviar la solicitud al backend
    fetch('https://matesitotest.onrender.com/grupos', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(groupData),
    })
    .then(response => {
        if (!response.ok) {
            throw new Error('Error al crear el grupo');
        }
        return response.json();
    })
    .then(data => {
        // Mostrar un mensaje de éxito y limpiar los campos
        alert(`Grupo creado exitosamente: ${data.name} con código de invitación: ${data.invite_code}`);
        document.getElementById('groupName').value = '';
        document.getElementById('groupDescription').value = '';
        document.getElementById('inviteCode').value = `${data.invite_code}`;
        joinGroup();
        createGroupMenu();
    })
    .catch(error => {
        alert(`Error: ${error.message}`);
    });
}

  function joinGroup() {
    const inviteCode = document.getElementById('inviteCode').value.trim();
    const userId = users[activeUser].id;

    if (!inviteCode) {
        alert('Por favor, ingresa un código de invitación.');
        return;
    }

    fetch('https://matesitotest.onrender.com/unir-grupo', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ inviteCode, userId }),
    })
    .then(response => {
        if (!response.ok) {
            return response.json().then(data => { throw new Error(data.error); });
        }
        return response.json();
    })
    .then(data => {
        alert(data.message);
        // Opcional: redirigir o actualizar la interfaz
    })
    .catch(error => {
        alert(`Error: ${error.message}`);
    });
}

  function leaveGroup(groupId) {
    const userId = users[activeUser].id;
    if (!confirm('¿Estás seguro de que deseas salir del grupo?')) {
        return; // Si el usuario cancela, no hacemos nada
    }

    fetch('https://matesitotest.onrender.com/salir-grupo', {
        method: 'DELETE',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ userId, groupId }),
    })
    .then(response => {
        if (!response.ok) {
            return response.json().then(data => { throw new Error(data.error); });
        }
        return response.json();
    })
    .then(data => {
        alert(data.message);
        // Opcional: Actualizar la interfaz después de salir del grupo
        document.getElementById(`menu-${groupId}`).style.display = 'none'; // Esconde el menú del grupo
    })
    .catch(error => {
        alert(`Error: ${error.message}`);
    });
}

  function reloadPosts() { 
    loadposts(loadAll);
}

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
                noForosMessage.style.textAlign = 'center';
                noForosMessage.style.color = 'gray';
                container.appendChild(noForosMessage);
            } else {
                // Renderizar los foros
                foros.forEach((foro, index) => {
                    const uniqueId = `${foro.id}-${index}-${Date.now()}`; // ID único
                    const foroElement = document.createElement('div');
                    foroElement.classList.add('user');
                
                    foroElement.innerHTML = `
                        <label for="label-${uniqueId}" class="boton">${foro.name}</label>
                        <input type="radio" id="label-${uniqueId}" name="nav" style="display:none;" onclick="toggle_ForumMenu('menu-${uniqueId}')">
                        <div id="menu-${uniqueId}" class="dropdown-menu" style="position: absolute; left: 188; top: -20;">
                            <h2 style="margin-top: -5px;">${foro.name}</h2>
                            <p style="margin-top: -10px;">${foro.description}</p>
                            <label for="view-${uniqueId}" class="boton">Ver Foro</label>
                            <input type="radio" id="view-${uniqueId}" name="nav" style="display:none;" onclick="loadForumPosts(${foro.id})">
                            <label for="follow-${uniqueId}" class="boton">Seguir foro</label>
                            <input type="radio" id="follow-${uniqueId}" name="nav" style="display:none;" onclick="joinForum(${foro.id})">
                            <label for="back-${uniqueId}" class="botonV">Volver</label>
                            <input type="radio" id="back-${uniqueId}" name="nav" style="display:none;" onclick="toggle_ForumMenu('menu-${uniqueId}')">
                        </div>
                    `;
                
                    container.appendChild(foroElement);
                });
            }
        })
        .catch(error => {
            console.error('Error al cargar los foros:', error);

            const container = document.getElementById('forosContainer');
            container.innerHTML = ''; // Limpiamos el contenedor antes de renderizar

            const noForosMessage = document.createElement('p');
            noForosMessage.textContent = 'No hay nada aquí';
            noForosMessage.style.textAlign = 'center';
            noForosMessage.style.color = 'gray';
            container.appendChild(noForosMessage);
            alert("Error al cargar los foros");
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
            const container = document.getElementById('forosContainer2');
            container.innerHTML = ''; // Limpiamos el contenedor

            if (forums.length === 0) {
                const noForumsMessage = document.createElement('p');
                noForumsMessage.textContent = 'No hay foros a los que estés unido';
                noForumsMessage.style.textAlign = 'center';
                noForumsMessage.style.color = 'gray';
                container.appendChild(noForumsMessage);
            } else {
                forums.forEach((foro, index) => {
                    const uniqueId = `${foro.id}-${index}-${Date.now()}`; // ID único
                    const forumElement = document.createElement('div');
                    forumElement.classList.add('user');
                
                    forumElement.innerHTML = `
                        <label for="label-${uniqueId}" class="boton">${foro.name}</label>
                        <input type="radio" id="label-${uniqueId}" name="nav" style="display:none;" onclick="toggle_ForumMenu('menu-${uniqueId}')">
                        <div id="menu-${uniqueId}" class="dropdown-menu" style="position: absolute; left: 188px; top: -20px;">
                            <h2 style="margin-top: -5px;">${foro.name}</h2>
                            <p style="margin-top: -10px;">${foro.description}</p>
                            <label for="view-${uniqueId}" class="boton">Ver Foro</label>
                            <input type="radio" id="view-${uniqueId}" name="nav" style="display:none;" onclick="loadForumPosts(${foro.id})">
                            <label for="follow-${uniqueId}" class="boton">Dejar foro</label>
                            <input type="radio" id="follow-${uniqueId}" name="nav" style="display:none;" onclick="leaveForum(${foro.id})">
                            <label for="back-${uniqueId}" class="botonV">Volver</label>
                            <input type="radio" id="back-${uniqueId}" name="nav" style="display:none;" onclick="toggle_ForumMenu('menu-${uniqueId}')">
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

  function loadUserCreatedForums() {
    const userId = users[activeUser].id; // ID del usuario activo

    fetch(`https://matesitotest.onrender.com/userCreatedForums/${userId}`)
        .then(response => response.json())
        .then(forums => {
            const container = document.getElementById('createdForosContainer');
            container.innerHTML = ''; // Limpiamos el contenedor

            if (forums.length === 0) {
                const noForumsMessage = document.createElement('p');
                noForumsMessage.textContent = 'No has creado ningún foro';
                noForumsMessage.style.textAlign = 'center';
                noForumsMessage.style.color = 'gray';
                container.appendChild(noForumsMessage);
            } else {
                forums.forEach((foro, index) => {
                    const uniqueId = `${foro.id}-${index}-${Date.now()}`; // ID único
                    const forumElement = document.createElement('div');
                    forumElement.classList.add('user');
                
                    forumElement.innerHTML = `
                        <label for="label-${uniqueId}" class="boton">${foro.name}</label>
                        <input type="radio" id="label-${uniqueId}" name="nav" style="display:none;" onclick="toggle_ForumMenu('menu-${uniqueId}')">
                        <div id="menu-${uniqueId}" class="dropdown-menu" style="position: absolute; left: 188px; top: -20px;">
                            <h2 style="margin-top: -5px;">${foro.name}</h2>
                            <p style="margin-top: -10px;">${foro.description}</p>
                            <label for="view-${uniqueId}" class="boton">Ver Foro</label>
                            <input type="radio" id="view-${uniqueId}" name="nav" style="display:none;" onclick="loadForumPosts(${foro.id})">
                            <label for="delete-${uniqueId}" class="boton">Eliminar Foro</label>
                            <input type="radio" id="delete-${uniqueId}" name="nav" style="display:none;" onclick="deleteForum(${foro.id})">
                            <label for="back-${uniqueId}" class="botonV">Volver</label>
                            <input type="radio" id="back-${uniqueId}" name="nav" style="display:none;" onclick="toggle_ForumMenu('menu-${uniqueId}')">
                        </div>
                    `;
                
                    container.appendChild(forumElement);
                });
            }
        })
        .catch(error => {
            console.error('Error al cargar los foros creados por el usuario:', error);
            alert('Error al cargar los foros creados por el usuario');
        });
}
  function deleteForum(forumId) {
    const userId = users[activeUser].id; // ID del usuario activo

    // Confirmar la eliminación
    const confirmDelete = confirm('¿Estás seguro de que deseas eliminar este foro?');
    if (!confirmDelete) {
        return;
    }

    fetch(`https://matesitotest.onrender.com/foros/${forumId}`, {
        method: 'DELETE',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ userId }),
    })
    .then(response => {
        if (!response.ok) {
            return response.json().then(data => {
                throw new Error(data || 'Error al eliminar el foro');
            });
        }
        return response.json();
    })
    .then(data => {
        alert(data); // Mensaje de éxito del backend
        loadUserCreatedForums(); // Actualiza la lista de foros creados
    })
    .catch(error => {
        console.error('Error al eliminar el foro:', error);
        alert(error.message || 'Error al eliminar el foro');
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

      function wherePost() {
        if (postList.style.display === 'block') {
            postpost();
        } else if (forumList.style.display === 'block') {
            sendForumMessage(activeForum);
        } else if (messageList.style.display === 'block') {
            sendChatMessage(activeChat);
        } else if (groupMessageList.style.display === 'block') {
            sendGroupMessage(activeGroup);
        } else {
            alert("No puedes publicar un mensaje aquí");
        }
    }
    

    let lastMessageContent = '';  // Definir una variable global fuera de la función para almacenar el contenido del último mensaje

  async  function sendForumMessage(forumId) {
    const content = document.getElementById('postContent').value;
    const isSensitive = document.getElementById('sensitiveContentCheckbox')?.checked || false;
    const fileInput = document.getElementById('postMedia');
    const file = fileInput.files[0];

    // Validar contenido prohibido
    if (containsForbiddenWords(content)) {
        alert("Creemos que tu mensaje infringe nuestros términos y condiciones. Si crees que es un error, contacta con soporte.");
        return;
    }

    // Verificar si el contenido es igual al último enviado
    if (content === lastMessageContent) {
        alert("No puedes enviar un mensaje igual al anterior.");
        return;
    }

    // Preparar los datos mensaje
    const messageData = {
        content,
        sensitive: isSensitive ? 1 : 0,
        sender_id: users[activeUser].id,
        createdAt: new Date().toISOString(),
        chat_or_group_id: forumId,
        is_private: false,
    };

    let media = null;
    let mediaType = null;

    if (file) {
        const formData = new FormData();
        formData.append("file", file);

        try {
            // Subir el archivo a Cloudinary u otro servicio
            const uploadResponse = await fetch('https://api.cloudinary.com/v1_1/dtzl420mq/upload', {
                method: 'POST',
                body: formData,
            });
            const uploadData = await uploadResponse.json();
            media = uploadData.secure_url;
            mediaType = file.type;

            // Añadir los datos de media al mensaje
            messageData.media = media;
            messageData.mediaType = mediaType;
        } catch (error) {
            console.error('Error al subir el archivo:', error);
            alert('Error al subir el archivo.');
            return;
        }
    }

    try {
        // Enviar el mensaje al servidor
        const response = await fetch(`https://matesitotest.onrender.com/mensajes/${forumId}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(messageData),
        });

        if (response.ok) {
            const responseData = await response.json();
            lastMessageContent = responseData.content;  // Actualizar la variable global
            document.getElementById('postContent').value = '';
            fileInput.value = '';
            alert('Mensaje enviado con éxito');
            loadForumPosts(forumId);
        } else {
            alert('Error al enviar el mensaje');
            loadForumPosts(forumId);
        }
    } catch (error) {
        console.error('Error al enviar el mensaje:', error);
        alert('Error al enviar el mensaje.');
    }
}

  async  function sendChatMessage(chatId) {
    const content = document.getElementById('postContent').value;
    const isSensitive = document.getElementById('sensitiveContentCheckbox')?.checked || false;
    const fileInput = document.getElementById('postMedia');
    const file = fileInput.files[0];

    // Validar contenido prohibido
    if (containsForbiddenWords(content)) {
        alert("Creemos que tu mensaje infringe nuestros términos y condiciones. Si crees que es un error, contacta con soporte.");
        return;
    }

    // Verificar si el contenido es igual al último enviado
    if (content === lastMessageContent) {
        alert("No puedes enviar un mensaje igual al anterior.");
        return;
    }

    // Preparar los datos del mensaje
    const messageData = {
        content,
        sensitive: isSensitive ? 1 : 0,
        sender_id: users[activeUser].id,
        createdAt: new Date().toISOString(),
        chat_or_group_id: chatId,
        is_private: true,  // Marcar el mensaje como privado
    };

    let media = null;
    let mediaType = null;

    if (file) {
        const formData = new FormData();
        formData.append("file", file);

        try {
            // Subir el archivo a Cloudinary u otro servicio
            const uploadResponse = await fetch('https://api.cloudinary.com/v1_1/dtzl420mq/upload', {
                method: 'POST',
                body: formData,
            });
            const uploadData = await uploadResponse.json();
            media = uploadData.secure_url;
            mediaType = file.type;

            // Añadir los datos de media al mensaje
            messageData.media = media;
            messageData.mediaType = mediaType;
        } catch (error) {
            console.error('Error al subir el archivo:', error);
            alert('Error al subir el archivo.');
            return;
        }
    }

    try {
        // Enviar el mensaje al servidor
        const response = await fetch(`https://matesitotest.onrender.com/mensajes/${chatId}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(messageData),
        });

        if (response.ok) {
            const responseData = await response.json();
            lastMessageContent = responseData.content;  // Actualizar la variable global
            document.getElementById('postContent').value = '';
            fileInput.value = '';
            alert('Mensaje enviado con éxito');
            loadChatMessages(chatId, loadAll);  // Cargar los mensajes del chat
        } else {
            alert('Error al enviar el mensaje');
            loadChatMessages(chatId, loadAll);  // Cargar los mensajes del chat
        }
    } catch (error) {
        console.error('Error al enviar el mensaje:', error);
        alert('Error al enviar el mensaje.');
    }
}

  async  function sendGroupMessage(groupId) {
    const content = document.getElementById('postContent').value;
    const isSensitive = document.getElementById('sensitiveContentCheckbox')?.checked || false;
    const fileInput = document.getElementById('postMedia');
    const file = fileInput.files[0];

    // Validar contenido prohibido
    if (containsForbiddenWords(content)) {
        alert("Tu mensaje puede infringir las políticas. Por favor revisa su contenido.");
        return;
    }

    let media = null;
    let mediaType = null;

    if (file) {
        const formData = new FormData();
        formData.append("file", file);

        try {
            // Subir el archivo a Cloudinary u otro servicio
            const uploadResponse = await fetch('https://api.cloudinary.com/v1_1/dtzl420mq/upload', {
                method: 'POST',
                body: formData,
            });
            const uploadData = await uploadResponse.json();
            media = uploadData.secure_url;
            mediaType = file.type;
        } catch (error) {
            console.error('Error al subir el archivo:', error);
            alert('Error al subir el archivo.');
            return;
        }
    }

    // Crear datos del mensaje
    const messageData = {
        content,
        sensitive: isSensitive ? 1 : 0,
        sender_id: users[activeUser].id,
        media,
        mediaType,
    };

    try {
        const response = await fetch(`https://matesitotest.onrender.com/group/messages/${groupId}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(messageData),
        });

        if (response.ok) {
            const responseData = await response.json();
            document.getElementById('postContent').value = '';
            fileInput.value = '';
            alert('Mensaje enviado con éxito');
            loadGroupMessages(groupId); // Cargar los mensajes del grupo
        } else {
            alert('Error al enviar el mensaje');
        }
    } catch (error) {
        console.error('Error al enviar el mensaje:', error);
        alert('Error al enviar el mensaje.');
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
                document.getElementById('postMedia').value = '';
                selectedFile = null;
                document.getElementById('loading').style.display = 'none';
                alert('Tu post se ha enviado correctamente');
                loadposts(loadAll);togglePosts();
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
                document.getElementById('postContent').value = '';
                selectedFile = null;
                alert('Tu post se ha enviado correctamente');
                loadposts(loadAll);togglePosts();
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
    const unicPostList = document.getElementById('unicPostList');
    const forumList = document.getElementById('forumList');
    const messageList = document.getElementById('messageList');
    const groupMessageList = document.getElementById('groupMessageList');

    if (profileList.style.display === 'block') {
        const username = document.getElementById('currentProfileUsername').value;
        unicPostList.style.display = 'none';
        viewProfile(username, loadAll); 

    } else if (postList.style.display === 'block') {
        unicPostList.style.display = 'none';
        loadposts(loadAll); 
    } else if (forumList.style.display === 'block') {
        unicPostList.style.display = 'none';
        loadForumPosts(activeForum, loadAll);
    }else if (messageList.style.display === 'block') {
        unicPostList.style.display = 'none';
        loadChatMessages(activeChat, loadAll);
    } else if (groupMessageList.style.display === 'block')
    {
        loadGroupMessages(activeGroup, loadAll);
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

  function loadposts(loadAll) {
    const unicPostList = document.getElementById('unicPostList');
    unicPostList.style.display = 'none';

    
    activeForum = '';
    activeChat = '';
    activeGroup = '';

    showOnlyMenu(postList, forumList, postList, messageList, groupMessageList, profileList);

    document.getElementById('postList').innerHTML = '';

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
            postsToRender.forEach(post => {
                const { content, media, mediaType, username, profilePicture, sensitive, createdAt, userId, postId } = post;

                // Filtrar contenido sensible correctamente
                if (!showSensitiveContent && sensitive === true) return;

                if (content && username) {
                    // Ahora estamos pasando postId a la función
                    addpostToList(content, media, mediaType, username, profilePicture, sensitive, createdAt, userId, postId, 'postList');
                } else {
                    console.warn('Post inválido omitido:', post);
                }
            });
        })
        .catch(error => {
            console.error('Error al cargar los posts:', error);
        });
}

  function createOrLoadChat(user2Id) {
    const user1Id = users[activeUser].id;

    if (!user1Id || !user2Id) {
        alert('IDs de usuario incompletos');
        return;
    }

    console.log(`Intentando cargar o crear un chat entre el usuario ${user1Id} y el usuario ${user2Id}...`);

    fetch('https://matesitotest.onrender.com/createOrLoadPrivateChat', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ user1Id, user2Id }),
    })
        .then(response => {
            if (!response.ok) {
                return response.json().then(errorData => {
                    throw new Error(errorData.error || 'Error desconocido');
                });
            }
            return response.json();
        })
        .then(data => {
            const { chatId } = data;
            if (!chatId) {
                throw new Error('No se recibió un chatId válido del servidor');
            }

            console.log(`Chat cargado o creado con éxito. ID del chat: ${chatId}`);

            // Llamar a la función de cargar mensajes
            loadChatMessages(chatId, loadAll);
            activeChat = chatId;
        })
        .catch(error => {
            console.error('Error en createOrLoadChat:', error);
            alert(`Error: ${error.message}`);
        });
}

  function loadChatMessages(chatId, loadAll) {
    showOnlyMenu(messageList, forumList, postList, messageList, groupMessageList, profileList);
    activeForum = '';
    activeGroup = '';

    document.getElementById('messageList').innerHTML = ''; // Limpiar lista de mensajes

    console.log(`Cargando mensajes del chat con ID: ${chatId}...`);
    fetch(`https://matesitotest.onrender.com/chat/messages/${chatId}`)
        .then(response => {
            if (!response.ok) {
                throw new Error(`Error al cargar los mensajes: ${response.status}`);
            }
            return response.json();
        })
        .then(messages => {
            console.log(`Mensajes cargados (${messages.length}):`, messages);

            const reversedMessages = messages.reverse(); // Ordenar los mensajes de más antiguos a más recientes

            const messagesToRender = loadAll ? reversedMessages : reversedMessages.slice(0, 12);

            messagesToRender.forEach(message => {
                const {
                    content,
                    media,
                    media_type: mediaType,
                    sensitive,
                    created_at: createdAt,
                    sender_id: userId,
                    username,
                    image: profilePicture,
                    id: messageId // Asegurarse de que se obtenga el ID del mensaje
                } = message;

                // Filtrar contenido sensible si es necesario
                if (!showSensitiveContent && sensitive === true) return;

                // Agregar mensaje a la lista
                addpostToList(
                    content,
                    media || null,
                    mediaType || null,
                    username || `Usuario ${userId}`,
                    profilePicture || '/default-profile.png',
                    sensitive,
                    createdAt,
                    userId,
                    messageId,
                    'messageList'
                );
            });
        })
        .catch(error => {
            console.error('Error al cargar los mensajes:', error);
        });
}

  function loadGroupMessages(groupId, loadAll) {
    showOnlyMenu(groupMessageList, forumList, postList, messageList, groupMessageList, profileList);

    activeForum = '';
    activeChat = '';

    activeGroup = groupId;

    const activeUserId = users[activeUser].id;

    document.getElementById('groupMessageList').innerHTML = ''; // Limpiar lista de mensajes

    console.log(`Cargando mensajes del grupo con ID: ${groupId} para el usuario activo ID: ${activeUserId}...`);
    fetch(`https://matesitotest.onrender.com/group/messages/${groupId}/${activeUserId}`)
        .then(response => {
            if (!response.ok) {
                throw new Error(`Error al cargar los mensajes: ${response.status}`);
            }
            return response.json();
        })
        .then(messages => {
            console.log(`Mensajes cargados (${messages.length}):`, messages);

            const reversedMessages = messages.reverse(); // Ordenar los mensajes de más antiguos a más recientes

            const messagesToRender = loadAll ? reversedMessages : reversedMessages.slice(0, 12);

            messagesToRender.forEach(message => {
                const {
                    content,
                    media,
                    media_type: mediaType,
                    sensitive,
                    created_at: createdAt,
                    sender_id: userId,
                    username,
                    image: profilePicture,
                    id: messageId // Asegurarse de que se obtenga el ID del mensaje
                } = message;

                // Filtrar contenido sensible si es necesario
                if (!showSensitiveContent && sensitive === true) return;

                // Agregar mensaje a la lista
                addpostToList(
                    content,
                    media || null,
                    mediaType || null,
                    username || `Usuario ${userId}`,
                    profilePicture || '/default-profile.png',
                    sensitive,
                    createdAt,
                    userId,
                    messageId,
                    'groupMessageList'
                );
            });
        })
        .catch(error => {
            console.error('Error al cargar los mensajes del grupo:', error);
        });
}

  function loadForumPosts(forumId, loadAll) {
   showOnlyMenu(forumList, forumList, postList, messageList, groupMessageList, profileList);

    document.getElementById('forumList').innerHTML = ''; // Limpiar lista de posts
   
    activeChat = '';
    activeGroup = '';
    activeForum = forumId;

    console.log(`Cargando mensajes del foro con ID: ${forumId}...`);
    fetch(`https://matesitotest.onrender.com/mensajes/${forumId}`)
        .then(response => {
            if (!response.ok) {
                throw new Error(`Error al cargar los mensajes: ${response.status}`);
            }
            return response.json();
        })
        .then(messages => {
            console.log(`Mensajes cargados (${messages.length}):`, messages);

            const reversedMessages = messages.reverse();

            const messagesToRender = loadAll ? reversedMessages : reversedMessages.slice(0, 12);

            messagesToRender.forEach(message => {
                const {
                    content,
                    media,
                    media_type: mediaType,
                    sensitive,
                    created_at: createdAt,
                    sender_id: userId,
                    username,
                    image: profilePicture,
                    id: postId // Asegurarse de que se obtenga el ID del mensaje
                } = message;

                // Filtrar contenido sensible si es necesario
                if (!showSensitiveContent && sensitive === true) return;

                // Agregar mensaje a la lista
                addpostToList(
                    content,
                    media || null,
                    mediaType || null,
                    username || `Usuario ${userId}`,
                    profilePicture || '/default-profile.png',
                    sensitive,
                    createdAt,
                    userId,
                    postId,
                    'forumList'
                );
            });
        })
        .catch(error => {
            console.error('Error al cargar los mensajes:', error);
        });
}



  function addpostToList(content, media, mediaType, username, profilePicture, sensitive, createdAt, userId, postId, listId) {
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
            mediaHTML = `<div><img src="${media}" alt="Imagen subida por ${username}" class="preview-media clickable"></div>`;
        } else if (mediaType.startsWith('video/')) {
            mediaHTML = `<div>
                            <video controls class="preview-media clickable">
                                <source src="${media}" type="${mediaType}">
                                Tu navegador no soporta la reproducción de video.
                            </video>
                         </div>`;
        } else if (mediaType.startsWith('audio/')) {
            mediaHTML = `<div>
                            <audio controls class="preview-media clickable">
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
                <div class="hidden-content clickable" style="display:none;">
                    ${content}
                    ${mediaHTML}
                </div>
           </div>`
        : `<div class="post-content clickable">${content}${mediaHTML}</div>`;

    // Crear un id único para la caja de usuario y para el widget de MicroReact
    const uniqueId = `userProfileBox_${userId}_${Math.random().toString(36).substr(2, 9)}`;
    const microReactId = `post-${postId}`;

    // HTML del post con MicroReact
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
        <div style="width:100%;display:flex;align-items:center;justify-content:center;margin-top:10px;">
           <iframe 
            src="https://matesitotest.onrender.com/microReact.html?id=Matesito_${microReactId}" 
                style="width: 275px; height: 100px; border: none;" 
                frameborder="0" 
                loading="lazy" 
                title="Deja una reacción">
            </iframe>
        </div>
    `;

    // Añadir eventos de clic solo a los elementos interactivos
    newpost.querySelectorAll('.clickable').forEach(element => {
        element.style.cursor = 'pointer'; // Cambiar cursor al pasar por encima
        element.addEventListener('click', () => {
            const unicPostList = document.getElementById('unicPostList');
            const postList = document.getElementById('postList');
            const profileList = document.getElementById('profileList');

            // Si unicPostList existe, eliminar el post previo y añadir el nuevo
            if (unicPostList) {
                unicPostList.innerHTML = ''; // Limpiar la lista
                unicPostList.appendChild(newpost); // Mover el nuevo post a la lista única
                localStorage.setItem('fixedPost', newpost.innerHTML);
                unicPostList.style.display = 'block';
            }

            // Ocultar otras listas
            if (postList) postList.style.display = 'none'; // Desactivar lista postList
            if (profileList) profileList.style.display = 'none'; // Desactivar lista profileList
        });
    });

    // Verificar si hay un post "fijo" al cargar la lista de posts
    if (localStorage.getItem('fixedPost')) {
        const unicPostList = document.getElementById('unicPostList');
        if (unicPostList) {
            unicPostList.innerHTML = localStorage.getItem('fixedPost'); // Mostrar el post "fijo"
        }
    }

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
    showOnlyMenu(profileList, forumList, postList, messageList, groupMessageList, profileList);
    activeForum = '';
    activeGroup = '';
    activeChat = '';

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
                const { content, media, mediaType, username, profilePicture, sensitive, createdAt, userId, postId } = post;
                // Filtrar contenido sensible si es necesario
                if (!showSensitiveContent && sensitive === true) return;
                if (content && username) {
                    addpostToList(content, media, mediaType, username, profilePicture, sensitive, createdAt, userId, postId, 'profileList');
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

    if (followerId === userId) {
        alert('No puedes seguirte ti mismo');
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
                    <div id="${Id}" class="dropdown-menu" style="position: absolute; left: 188px; top: -20px;">
                        <label for="${username}${Id}" class="boton">Ver perfil</label>
                        <input type="radio" id="${username}${Id}" name="nav" style="display:none;" onclick="viewProfile('${username}')">
                        <label for="${Id}${username}${Id}" class="boton">Dejar de seguir</label>
                        <input type="radio" id="${Id}${username}${Id}" name="nav" style="display:none;" onclick="unfollowUser(${followerId}, ${Id})">
                        <label for="${Id}${Id}" class="boton">Chat privado</label>
                        <input type="radio" id="${Id}${Id}" name="nav" style="display:none;" onclick="createOrLoadChat(${Id})">
                        

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

  function loadUserGroups() {
    const userId = users[activeUser]?.id; // ID del usuario activo

    fetch(`https://matesitotest.onrender.com/grupos-usuario/${userId}`)
        .then(response => response.json())
        .then(groups => {
            const container = document.getElementById('joinedGruposContainer');
            const container1 = document.getElementById('createdGroupsContainer');
            container.innerHTML = ''; // Limpiamos el contenedor
            container1.innerHTML = '';

            if (groups.length === 0) {
                // Si no pertenece a ningún grupo, mostramos un mensaje
                const noGroupsMessage = document.createElement('p');
                noGroupsMessage.textContent = 'No perteneces a ningún grupo';
                noGroupsMessage.style.textAlign = 'center';
                noGroupsMessage.style.color = 'gray';
                container.appendChild(noGroupsMessage);
            } else {
                // Renderizamos los grupos
                groups.forEach(group => {
                    const groupElement = document.createElement('div');
                    groupElement.classList.add('group');

                    const groupId = group.id;
                    const groupName = group.name;

                    // Asegurarnos de que los IDs y nombres son únicos
                    const menuId = `menus-${groupId}`;
                    const radioId = `radios-${groupId}`;

                    groupElement.innerHTML = `
                    <label for="${radioId}" class="boton">${groupName}</label>
                    <input type="radio" id="${radioId}" name="nav-${groupId}" style="display:none;" onclick="toggle_GroupMenu1('${menuId}')">

                    <div id="${menuId}" class="dropdown-menu" style="position: absolute; left: 188px; top: -20px; display: none;">
                        <label for="details-${groupId}v" class="boton">Ver detalles</label>
                        <input type="radio" id="details-${groupId}v" name="nav-${groupId}" style="display:none;" onclick="toggleDetails1('details-${menuId}', ${groupId})">
                        
                        <!-- Contenedor para los detalles del grupo -->
                        <div id="details-${menuId}" style="display: none;">
                            <div id="groupDetailsContainer-${groupId}">
                                <!-- Los detalles del grupo se cargarán aquí -->
                            </div>
                        </div>

                        <label for="enter-${menuId}-${groupId}" class="boton">Entrar al chat</label>
                        <input type="radio" id="enter-${menuId}-${groupId}" name="nav-${groupId}" style="display:none;" onclick="loadGroupMessages(${groupId})">

                        <label for="leave-${menuId}${groupId}" class="boton">Salir del grupo</label>
                        <input type="radio" id="leave-${menuId}${groupId}" name="nav-${groupId}" style="display:none;" onclick="leaveGroup(${groupId})">

                        <label for="${menuId}${groupId}" class="botonV">Volver</label>
                        <input type="radio" id="${menuId}${groupId}" name="nav-${groupId}" style="display:none;" onclick="toggle_GroupMenu1('${menuId}')">
                    </div>
                    `;

                    container.appendChild(groupElement);
                });
            }
        })
        .catch(error => {
            console.error('Error al cargar los grupos del usuario:', error);
            alert('Error al cargar los grupos del usuario');
        });
}

  function loadCreatedGroups() {
    const userId = users[activeUser]?.id; // ID del usuario activo

    fetch(`https://matesitotest.onrender.com/grupos-creados/${userId}`)
        .then(response => response.json())
        .then(groups => {
            const container = document.getElementById('createdGroupsContainer');
            const container1 = document.getElementById('joinedGruposContainer');
            container.innerHTML = ''; // Limpiamos el contenedor
            container1.innerHTML = '';

            if (groups.length === 0) {
                const noGroupsMessage = document.createElement('p');
                noGroupsMessage.textContent = 'No has creado ningún grupo';
                noGroupsMessage.style.textAlign = 'center';
                noGroupsMessage.style.color = 'gray';
                container.appendChild(noGroupsMessage);
            } else {
                groups.forEach(group => {
                    const groupElement = document.createElement('div');
                    groupElement.classList.add('group');

                    const groupId = group.id;

                    groupElement.innerHTML = `
                    <label for="radio-${groupId}" class="boton">${group.name}</label>
                    <input type="radio" id="radio-${groupId}" name="nav" style="display:none;" onclick="toggle_GroupMenu('menu-${groupId}')">

                    <div id="menu-${groupId}" class="dropdown-menu" style="position: absolute; left: 188px; top: -20px; display: none;">
                        <label for="details-${groupId}b" class="boton">Ver detalles</label>
                        <input type="radio" id="details-${groupId}b" name="nav" style="display:none;" onclick="toggleDetails('details-${groupId}', ${groupId})">
                        
                        <div id="details-${groupId}" style="display: none;">
                            <div id="GroupDetailsContainer-${groupId}">
                                <!-- Los detalles del grupo se cargarán aquí -->
                            </div>
                        </div>

                        <label for="enter-${groupId}" class="boton">Entrar al chat</label>
                        <input type="radio" id="enter-${groupId}" name="nav" style="display:none;" onclick="loadGroupMessages(${groupId})">

                        <label for="delete-${groupId}" class="boton">Eliminar grupo</label>
                        <input type="radio" id="delete-${groupId}" name="nav" style="display:none;" onclick="deleteGroup(${groupId})">

                        <label for="close-${groupId}" class="botonV">Volver</label>
                        <input type="radio" id="close-${groupId}" name="nav" style="display:none;" onclick="toggle_GroupMenu('menu-${groupId}')">
                    </div>
                    `;

                    container.appendChild(groupElement);
                });
            }
        })
        .catch(error => {
            console.error('Error al cargar los grupos creados:', error);
            alert('Error al cargar los grupos creados');
        });
}

  function deleteGroup(groupId) {
    const userId = users[activeUser]?.id; // ID del usuario activo

    fetch(`https://matesitotest.onrender.com/grupo/${groupId}/${userId}`, {
        method: 'DELETE',
    })
        .then(response => response.json())
        .then(data => {
            if (data.message) {
                alert(data.message); // Mostrar mensaje de éxito
                loadCreatedGroups(); // Volver a cargar los grupos creados
            } else {
                alert(data.error); // Mostrar mensaje de error
            }
        })
        .catch(error => {
            console.error('Error al eliminar el grupo:', error);
            alert('Error al eliminar el grupo');
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

  function wait(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}
    
  async  function init() {
    toggleVisibility('postList');
    
    await wait(200);
    
    toggleVisibility('postList');
    }

// Llamar a loadposts al cargar    página
window.onload = verMant(mantenimiento);
window.onload = checkRememberedUser();
window.onload = init();
window.onload = reloadPosts();