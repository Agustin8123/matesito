let users = {};
let activeUser = '';
let loginWidgetId;

   function hideUserSelectOverlay() {
    document.getElementById('usernameOverlay').style.display = 'none';
}

   function updateUsername() {
    const newUsername = document.getElementById('newUsername').value.trim();
    if (!newUsername) {
        notify('El nombre de usuario no puede estar vacío.');
        return;
    }

    fetch('/updateUsername', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentUsername: activeUser, newUsername }), // Cambié 'oldUsername' por 'currentUsername'
    })
    .then(readResponse)
    .then(data => {
        if (data.success) {
            notify('Nombre de usuario actualizado.');
            users[newUsername] = users[activeUser];
            delete users[activeUser];
            activeUser = newUsername;
            document.cookie = 'username=' + encodeURIComponent(newUsername) + '; path=/; SameSite=Lax';
            updateUserButton(); // Actualiza la variable global con el nuevo nombre
            document.getElementById('newUsername').value = '';
        } else {
            notify(data.error || data.message || 'Error al actualizar el nombre de usuario.');
        }
    })
    .catch(error => console.error('Error al actualizar el nombre:', error));
}

   function togglePassword() {
    togglePasswordInput('currentPassword', 'togglePasswordButton');
}

   function togglePassword1() {
    togglePasswordInput('newPassword', 'togglePasswordButton');
}

   function togglePassword2() {
    togglePasswordInput('passwordInput1', 'toggleBotonPassword');
}

   function updatePassword() {
    const currentPassword = document.getElementById('currentPassword').value;
    const newPassword = document.getElementById('newPassword').value;

    if (!currentPassword || !newPassword) {
        notify('Ambos campos de contraseña deben estar completos.');
        return;
    }

    fetch('/updatePassword', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
            username: activeUser, 
            currentPassword, 
            newPassword 
        }),
    })
    .then(readResponse)
    .then(data => {
        if (data.success) {
            notify('Contraseña actualizada con éxito.');
            document.getElementById('currentPassword').value = '';
            document.getElementById('newPassword').value = '';
        } else {
            notify(data.error || data.message || 'Error al actualizar la contraseña.');
        }
    })
    .catch(error => console.error('Error al actualizar la contraseña:', error));
}

function updateDescription() {
    const newDescription = document.getElementById('userDescription').value.trim();

    if (!newDescription) {
        notify('La descripción no puede estar vacía.');
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
    .then(readResponse)
    .then(data => {
        if (data.success) {
            notify('Descripción actualizada con éxito.');
            document.getElementById('userDescription').value = '';
        } else {
            notify(data.error || data.message || 'Error al actualizar la descripción.');
        }
    })
    .catch(error => {
        console.error('Error al actualizar la descripción:', error);
        notify('No se pudo actualizar la descripción.');
    });
}

   function updateProfileImage() {
    const profileImageInput = document.getElementById('profileImage');
    if (!profileImageInput.files || !profileImageInput.files[0]) {
        notify('Por favor selecciona una imagen para subir.');
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
    .then(readResponse)
    .then(data => {
        const newProfileImageURL = data.secure_url; // Obtener la URL de la imagen subida
        // Actualizar la URL de la imagen en la base de datos
        updateProfileImageInDatabase(newProfileImageURL);
    })
    .catch(error => {
        console.error('Error al subir la imagen:', error);
        notify('No se pudo subir la imagen de perfil. Inténtalo de nuevo.');
    });
}

   function updateProfileImageInDatabase(newProfileImageURL) {
    fetch('/updateProfileImage', {
        method: 'PUT',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            username: activeUser,
            profileImage: newProfileImageURL, // Nueva URL de la imagen
        }),
    })
    .then(readResponse)
    .then(data => {
        if (data.success) {
            notify('Imagen de perfil actualizada con éxito.');
            // Aquí puedes actualizar la UI si es necesario
        } else {
            notify('Error al actualizar la imagen de perfil en la base de datos.');
        }
    })
    .catch(error => {
        console.error('Error al actualizar la imagen de perfil en la base de datos:', error);
        notify('Error al actualizar la imagen de perfil. Inténtalo de nuevo.');
    });
}

function loginUser() {
const username = document.getElementById('usernameInput').value.trim();
const password = document.getElementById('passwordInput1').value;
const usernameOverlay = document.getElementById('usernameOverlay');
const token = turnstile.getResponse(loginWidgetId);


if (!token) {
    notify("Completa la verificación de seguridad.");
    return;
}

fetch('/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password, token })
})
.then(readResponse)
.then(data => {
    if (data.username) {
        setActiveUser(data.username); 
        usernameOverlay.style.display = 'none';
    } else {
        notify('Error al iniciar sesión');
        
    }
    if (loginWidgetId !== undefined) turnstile.reset(loginWidgetId);

})
.catch(error => {
    notify('Error de conexión');
    if (loginWidgetId !== undefined) turnstile.reset(loginWidgetId);

});
}

function Acept1() {
  const initial = document.getElementById('usernameOverlay');
  const aviso = document.getElementById('AvisoOverlay');
  if (loginWidgetId === undefined) {
    loginWidgetId = turnstile.render('#turnstileLogin', { sitekey: '0x4AAAAAACXaLFPU3wAuzN1y' });
  } else {
    turnstile.reset(loginWidgetId);
  }
  if (initial) initial.style.display = 'flex';
  if (aviso) aviso.style.display = 'none';
}