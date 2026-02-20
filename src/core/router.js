export function route(){
  const raw = (location.hash || "#/").slice(1);
  const [pathPart, queryPart] = raw.split("?");
  const path = pathPart || "/";
  const params = new URLSearchParams(queryPart || "");
  return { path, params };
}

export function setHash(path, params){
  const qs = params ? `?${params.toString()}` : "";
  location.hash = `#${path}${qs}`;
}
