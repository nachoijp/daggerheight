const NAMESPACE = "com.ignaciopedraza.daggerheight";

/** Get the reverse domain name id for this plugin at a given path */
export function getPluginId(path: string) {
  return `${NAMESPACE}/${path}`;
}
