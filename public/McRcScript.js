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

let previousReaction = null;  // Guardar la reacción anterior

reactions.forEach(async function (reaction) {
  const el = document.querySelector(`[data-reaction-id="${reaction}"]`);
  const list = document.querySelector(`[data-list-id="${reaction}"]`);

  if (!el || !list) {
    document.body.innerHTML = `<div style="background-color:red;color:white;font-size:11.6px;padding:3px;font-family:monospace;overflow: auto;width: 262px;height: 80px;"><b>MicroReact ERROR [for website owner]:</b> Reaction ID ${reaction.replace(/</g, "&lt;").replace(/>/g, "&gt;")} not found. Check <a href="microreact.glitch.me" style="color:white;font-weight: bold;">the docs</a> for usage.<br><br>Please check your MicroReact iframe's URL and verify that it's reaction ids are only 1, 2, 3, 4 or 5 and are not separated. Example: "15". Default: "12345"</div>`;
    throw new Error("MicroReact ERROR: Reaction ID does not exist.");
    return;
  }

  el.style.display = "block";
  list.style.display = "block";

  el.addEventListener("click", function (evt) {
    // Restar la cuenta de la reacción anterior si existe
    if (previousReaction) {
      fetch(`https://${API_BASE}/hit/microreact--reactions/${encodeURIComponent(id)}/${previousReaction}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ decrement: true })
      }).then(response => response.json())
        .then(data => {
          // Actualizar la UI después de restar la reacción anterior
          console.log('Reacción anterior restada');
        }).catch(error => console.error('Error al restar la reacción:', error));
    }

    // Actualizar la cuenta de la nueva reacción
    fetch(`https://${API_BASE}/hit/microreact--reactions/${encodeURIComponent(id)}/${reaction}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" }
    }).then(response => {
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

        // Actualizar el número de reacciones
        try {
          const reactionData = await fetch(
            `https://${API_BASE}/get/microreact--reactions/${encodeURIComponent(id)}?reaction=${encodeURIComponent(reaction)}`
          );
          const json = await reactionData.json();
          list.innerText = json.value || 0;
        } catch (error) {
          console.error("Error al obtener las reacciones:", error);
          list.innerText = "0"; 
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

      // Guardar la nueva reacción como la reacción actual
      previousReaction = reaction;
    }).catch(error => console.error("Error al realizar la solicitud de reacción:", error));
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