let users = {};  // Objeto para almacenar los usuarios y contraseñas y sus imágenes de perfil
    

   function Acept() {
    document.getElementById('usernameOverlay').style.display = 'flex';
    document.getElementById('appContainer').style.display = 'flex';
    document.getElementById('AvisoOverlay').style.display = 'none';
}

// Función de login
   function loginUser() {
    const username = document.getElementById('usernameInput').value.trim();
    const password = document.getElementById('passwordInput1').value.trim();
    
    fetch(' /login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
    })
    .then(response => response.json())
    .then(data => {
        if (data.username) {
            setActiveUser(data.username); // Función para actualizar el usuario activo
        } else {
            alert('Error al iniciar sesión');
        }
    })
    .catch(error => {
        alert('Error de conexión');
    });
}

   function setActiveUser(username) {
    fetch(' /getUserDetails', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username }),
    })
    .then(response => response.json())
    .then(data => {
        if (data.id) {
            // Guardar detalles del usuario activo
            activeUser = username;
            if (!users[username]) {
                users[username] = {}; // Asegurarse de que el usuario exista en la estructura
            }
            users[username].profileImage = data.profileImage || 'default-avatar.png'; // Guardar la URL de la imagen
            users[username].description = data.description || '';
            document.getElementById('userDescription').value = users[username].description;

            // Actualizar la UI
            hideUserSelectOverlay();
        } else {
            alert("Usuario no encontrado.");
        }
    })

    .catch(error => {
        console.error("Error al obtener los detalles del usuario:", error);
        alert("Error al obtener los detalles del usuario.");
    });
}

   function hideUserSelectOverlay() {
    document.getElementById('usernameOverlay').style.display = 'none';
}

   function updateUsername() {
    const newUsername = document.getElementById('newUsername').value.trim();
    if (!newUsername) {
        alert('El nombre de usuario no puede estar vacío.');
        return;
    }

    fetch(' /updateUsername', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentUsername: activeUser, newUsername }), // Cambié 'oldUsername' por 'currentUsername'
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            alert('Nombre de usuario actualizado.');
            activeUser = newUsername; // Actualiza la variable global con el nuevo nombre
            document.getElementById('newUsername').value = '';
        } else {
            alert(data.message || 'Error al actualizar el nombre de usuario.');
        }
    })
    .catch(error => console.error('Error al actualizar el nombre:', error));
}

   function togglePassword() {
    const passwordInput = document.getElementById('currentPassword');
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
    const passwordInput = document.getElementById('newPassword');
    const toggleButton = document.getElementById('togglePasswordBoton');

    if (passwordInput.type === "password") {
        passwordInput.type = "text";
        toggleButton.innerHTML = '<img src="eyeOpen.png" alt="Ocultar Contraseña">';
    } else {
        passwordInput.type = "password";
        toggleButton.innerHTML = '<img src="eyeClose.png" alt="Ver Contraseña">';
    }
}

   function togglePassword2() {
    const passwordInput = document.getElementById('passwordInput1');
    const toggleButton = document.getElementById('toggleBotonPassword');

    if (passwordInput.type === "password") {
        passwordInput.type = "text";
        toggleButton.innerHTML = '<img src="eyeOpen.png" alt="Ocultar Contraseña">';
    } else {
        passwordInput.type = "password";
        toggleButton.innerHTML = '<img src="eyeClose.png" alt="Ver Contraseña">';
    }
}

   function updatePassword() {
    const currentPassword = document.getElementById('currentPassword').value.trim();
    const newPassword = document.getElementById('newPassword').value.trim();

    if (!currentPassword || !newPassword) {
        alert('Ambos campos de contraseña deben estar completos.');
        return;
    }

    fetch(' /updatePassword', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
            username: activeUser, 
            currentPassword, 
            newPassword 
        }),
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            alert('Contraseña actualizada con éxito.');
            document.getElementById('currentPassword').value = '';
            document.getElementById('newPassword').value = '';
        } else {
            alert(data.message || 'Error al actualizar la contraseña.');
        }
    })
    .catch(error => console.error('Error al actualizar la contraseña:', error));
}

function updateDescription() {
    const newDescription = document.getElementById('userDescription').value.trim();

    if (!newDescription) {
        alert('La descripción no puede estar vacía.');
        return;
    }

    fetch('/updateDescription', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
            username: activeUser, 
            description: newDescription 
        }),
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            alert('Descripción actualizada con éxito.');
            document.getElementById('userDescription').value = '';
        } else {
            alert(data.message || 'Error al actualizar la descripción.');
        }
    })
    .catch(error => {
        console.error('Error al actualizar la descripción:', error);
        alert('No se pudo actualizar la descripción.');
    });
}

   function updateProfileImage() {
    const profileImageInput = document.getElementById('profileImage');
    if (!profileImageInput.files || !profileImageInput.files[0]) {
        alert('Por favor selecciona una imagen para subir.');
        return;
    }

    const formData = new FormData();
    formData.append('file', profileImageInput.files[0]);
    formData.append('upload_preset', 'matesito'); // Cambia esto por tu preset de Cloudinary

    // Subir la imagen a Cloudinary
    fetch('https://api.cloudinary.com/v1_1/dtzl420mq/upload', {
        method: 'POST',
        body: formData,
    })
    .then(response => response.json())
    .then(data => {
        const newProfileImageURL = data.secure_url; // Obtener la URL de la imagen subida
        // Actualizar la URL de la imagen en la base de datos
        updateProfileImageInDatabase(newProfileImageURL);
    })
    .catch(error => {
        console.error('Error al subir la imagen:', error);
        alert('No se pudo subir la imagen de perfil. Inténtalo de nuevo.');
    });
}

   function updateProfileImageInDatabase(newProfileImageURL) {
    fetch(' /updateProfileImage', {
        method: 'PUT',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            username: activeUser,
            profileImage: newProfileImageURL, // Nueva URL de la imagen
        }),
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            alert('Imagen de perfil actualizada con éxito.');
            // Aquí puedes actualizar la UI si es necesario
        } else {
            alert('Error al actualizar la imagen de perfil en la base de datos.');
        }
    })
    .catch(error => {
        console.error('Error al actualizar la imagen de perfil en la base de datos:', error);
        alert('Error al actualizar la imagen de perfil. Inténtalo de nuevo.');
    });
}
