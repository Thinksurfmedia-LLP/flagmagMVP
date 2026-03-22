const BASE = "";

async function request(method, path, body) {
    const opts = {
        method,
        headers: { "Content-Type": "application/json" },
        credentials: "include",
    };
    if (body) opts.body = JSON.stringify(body);

    const res = await fetch(`${BASE}${path}`, opts);
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || "Request failed");
    return json;
}

export const apiGet = (path) => request("GET", path);
export const apiPost = (path, body) => request("POST", path, body);
export const apiPut = (path, body) => request("PUT", path, body);
export const apiDelete = (path) => request("DELETE", path);
