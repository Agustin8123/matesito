// Función para obtener el userID desde las cookies
function getUserIDFromCookies() {
  const cookies = document.cookie.split("; ");
  for (const cookie of cookies) {
      const [name, value] = cookie.split("=");
      if (name === "userID") {
          return decodeURIComponent(value);
      }
  }
  return null;
}

const userID = getUserIDFromCookies();

const params = new URLSearchParams(window.location.search);
const id = params.get("id");

const reactions = (params.get("reactions") || "12345").split("");
const allowMultiple = !!(params.get("allowMultiple") || 0);
const textColor = decodeURIComponent(params.get("textColor") || "") || false;
const bgColor = decodeURIComponent(params.get("bgColor") || "") || false;
const font = decodeURIComponent(params.get("font") || "") || false;

const API_BASE =
decodeURIComponent(params.get("api_base") || "") || "matesitotest.onrender.com";

if (!id) {
  document.body.innerHTML = `<div style="background-color:red;color:white;font-size:11.6px;padding:3px;font-family:monospace;overflow: auto;width: 262px;height: 80px;"><b>MicroReact ERROR [for website owner]:</b> No unique identifier set in URL parameters. Check <a href="microreact.glitch.me" style="color:white;font-weight: bold;">the docs</a> for usage.<br><br>Please check your MicroReact iframe's URL and verify that it has the URL parameter "id"</div>`;
  throw new Error(
      "MicroReact ERROR: No unique identifier set in URL parameters. More details inside the iframe."
  );
}

reactions.forEach(async function (reaction) {
  const el = document.querySelector(`[data-reaction-id="${reaction}"]`);
  const list = document.querySelector(`[data-list-id="${reaction}"]`);

  if (!el || !list) {
      document.body.innerHTML = `<div style="background-color:red;color:white;font-size:11.6px;padding:3px;font-family:monospace;overflow: auto;width: 262px;height: 80px;"><b>MicroReact ERROR [for website owner]:</b> Reaction ID ${reaction
          .replace(/</g, "&lt;")
          .replace(/>/g, "&gt;")} not found. Check <a href="microreact.glitch.me" style="color:white;font-weight: bold;">the docs</a> for usage.<br><br>Please check your MicroReact iframe's URL and verify that its reaction IDs are only 1, 2, 3, 4, or 5. Example: "15". Default: "12345"</div>`;
      throw new Error("MicroReact ERROR: Reaction ID does not exist. More details inside the iframe.");
      return;
  }

  el.style.display = "block";
  list.style.display = "block";

  el.addEventListener("click", function () {
      if (!userID) {
          alert("Error: No se encontró un ID de usuario en las cookies.");
          return;
      }

      fetch(`https://${API_BASE}/hit/microreact--reactions/${encodeURIComponent(id)}/${reaction}`, {
          method: "POST",
          headers: {
              "Content-Type": "application/json",
          },
          body: JSON.stringify({ user_id: userID }),
      })
      .then(response => {
          el.style.opacity = "0";
          el.style.transform = "scale(0.8) rotate(20deg)";
          list.style.opacity = "0";
          list.style.marginBottom = "-10px";

          let originalText = el.innerText;

          setTimeout(async function () {
              list.style.opacity = "1";
              list.style.marginBottom = "0px";
              el.style.opacity = ".7";
              el.innerText = "✔️";
              el.style.transform = "scale(1)";

              try {
                  const reactionData = await fetch(
                      `https://${API_BASE}/get/microreact--reactions/${encodeURIComponent(id)}?reaction=${encodeURIComponent(reaction)}`
                  );
                  const json = await reactionData.json();
                  list.innerText = json.value || 0;
              } catch (error) {
                  console.error("Error al obtener las reacciones:", error);
                  list.innerText = "error";
              }
          }, 250);

          setTimeout(function () {
              el.style.opacity = "0";
              el.style.transform = "scale(0.8) rotate(60deg)";
          }, 1250);

          setTimeout(function () {
              el.style.opacity = "1";
              el.style.transform = "scale(1)";
              el.innerText = originalText;
          }, 1500);

          if (!allowMultiple) {
              document.querySelectorAll(`[data-reaction-id]`).forEach((l) => {
                  l.setAttribute("disabled", "true");
              });
              document.querySelectorAll(`[data-list-id]`).forEach((l) => {
                  if (!(l === list)) {
                      l.style.opacity = ".4";
                  }
              });
          }
      })
      .catch(error => {
          console.error("Error al realizar la solicitud de reacción:", error);
      });
  });

  try {
      const reactionData = await fetch(
        `https://${API_BASE}/get/microreact--reactions/${encodeURIComponent(id)}?reaction=${encodeURIComponent(reaction)}`
      );
      const json = await reactionData.json();
      list.innerText = json.value || 0;
  } catch {
      list.innerText = "0";
  }

  socket.on('reloadReactions', async (data) => {
    const { id, previousReaction, newReaction } = data;
    
    console.log(`Recibido evento: ${JSON.stringify(data)}`);

    try {
        const response = await fetch(`https://${API_BASE}/get/microreact--reactions/${encodeURIComponent(id)}`);
        const json = await response.json();

        if (json.reactions) {
            console.log("Reacciones actualizadas:", json.reactions);

            // Actualizar solo las reacciones afectadas
            if (previousReaction) {
                const prevCountElement = document.querySelector(`#${id}-${previousReaction}`);
                if (prevCountElement) {
                    prevCountElement.textContent = json.reactions[previousReaction] || 0;
                } else {
                    console.warn(`No se encontró el elemento para ${previousReaction}`);
                }
            }

            if (newReaction) {
                const newCountElement = document.querySelector(`#${id}-${newReaction}`);
                if (newCountElement) {
                    newCountElement.textContent = json.reactions[newReaction] || 0;
                } else {
                    console.warn(`No se encontró el elemento para ${newReaction}`);
                }
            }
        }
    } catch (error) {
        console.error("Error al actualizar reacciones:", error);
    }
});
});

let css = "";

if (textColor) {
  css = css + `* {color: ${textColor} !important}` + "\n";
}
if (bgColor) {
  css = css + `body {background-color: ${bgColor} !important}` + "\n";
}
if (font) {
  css = css + `* {font-family: ${font} !important}` + "\n";
}

const styleEl = document.createElement("style");
styleEl.textContent = css;
document.body.appendChild(styleEl);