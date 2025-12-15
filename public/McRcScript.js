// ================================
// USER ID (localStorage + cookies)
// ================================
function getUserID() {
  const fromLocal = localStorage.getItem("userID");
  if (fromLocal) return fromLocal;

  const cookies = document.cookie.split("; ");
  for (const cookie of cookies) {
    const [name, value] = cookie.split("=");
    if (name === "userID") {
      return decodeURIComponent(value);
    }
  }
  return null;
}

const userID = getUserID();

// ================================
// URL PARAMS
// ================================
const params = new URLSearchParams(window.location.search);
const id = params.get("id");

const reactions = (params.get("reactions") || "12345").split("");
const allowMultiple = !!Number(params.get("allowMultiple") || 0);
const textColor = decodeURIComponent(params.get("textColor") || "") || false;
const bgColor = decodeURIComponent(params.get("bgColor") || "") || false;
const font = decodeURIComponent(params.get("font") || "") || false;

const API_BASE =
  decodeURIComponent(params.get("api_base") || "") || "matesito.com.ar";

// ================================
// VALIDACIÓN ID
// ================================
if (!id) {
  document.body.innerHTML = `
    <div style="background-color:red;color:white;font-size:11.6px;padding:3px;font-family:monospace;">
      <b>MicroReact ERROR:</b> Falta el parámetro <b>id</b> en la URL
    </div>`;
  throw new Error("MicroReact ERROR: Missing ID");
}

// ================================
// MAIN LOGIC
// ================================
reactions.forEach(async function (reaction) {
  const el = document.querySelector(`[data-reaction-id="${reaction}"]`);
  const list = document.querySelector(`[data-list-id="${reaction}"]`);

  if (!el || !list) {
    document.body.innerHTML = `
      <div style="background-color:red;color:white;font-size:11.6px;padding:3px;font-family:monospace;">
        <b>MicroReact ERROR:</b> Reaction ID ${reaction} no encontrada
      </div>`;
    throw new Error("Reaction element missing");
  }

  el.style.display = "block";
  list.style.display = "block";

  // ================================
  // CLICK
  // ================================
  el.addEventListener("click", async function () {
    if (!userID) {
      alert("No hay sesión activa.");
      return;
    }

    try {
      await fetch(
        `https://${API_BASE}/hit/microreact--reactions/${encodeURIComponent(id)}/${reaction}`,
        {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ user_id: userID }),
        }
      );

      // Animación
      el.style.opacity = "0";
      el.style.transform = "scale(0.8) rotate(20deg)";
      list.style.opacity = "0";

      const originalText = el.innerText;

      setTimeout(async () => {
        el.innerText = "✔️";
        el.style.opacity = ".7";
        el.style.transform = "scale(1)";
        list.style.opacity = "1";

        const r = await fetch(
          `https://${API_BASE}/get/microreact--reactions/${encodeURIComponent(id)}?reaction=${reaction}`,
          { credentials: "include" }
        );
        const json = await r.json();
        list.innerText = json.value || 0;
      }, 250);

      setTimeout(() => {
        el.innerText = originalText;
        el.style.opacity = "1";
      }, 1500);

      if (!allowMultiple) {
        document.querySelectorAll(`[data-reaction-id]`).forEach(b =>
          b.setAttribute("disabled", "true")
        );
      }

    } catch (err) {
      console.error("Error en reacción:", err);
    }
  });

  // ================================
  // LOAD INITIAL COUNT
  // ================================
  try {
    const r = await fetch(
      `https://${API_BASE}/get/microreact--reactions/${encodeURIComponent(id)}?reaction=${reaction}`,
      { credentials: "include" }
    );
    const json = await r.json();
    list.innerText = json.value || 0;
  } catch {
    list.innerText = "0";
  }
});

// ================================
// SOCKET UPDATE (si existe)
// ================================
if (typeof socket !== "undefined") {
  socket.on("reloadReactions", async data => {
    try {
      const r = await fetch(
        `https://${API_BASE}/get/microreact--reactions/${encodeURIComponent(data.id)}`,
        { credentials: "include" }
      );
      const json = await r.json();

      if (json.reactions) {
        json.reactions.forEach(r => {
          const el = document.querySelector(`[data-list-id="${r.reaction_id}"]`);
          if (el) el.innerText = r.count;
        });
      }
    } catch {
      console.error("No se pudieron actualizar reacciones");
    }
  });
}

// ================================
// STYLES
// ================================
let css = "";

if (textColor) css += `* { color: ${textColor} !important }\n`;
if (bgColor) css += `body { background-color: ${bgColor} !important }\n`;
if (font) css += `* { font-family: ${font} !important }\n`;

if (css) {
  const style = document.createElement("style");
  style.textContent = css;
  document.head.appendChild(style);
}
