export interface RouteSeoMeta {
  title: string;
  description: string;
  path: string;
  ogType?: 'website' | 'article';
  robots?: string;
  jsonLd?: Record<string, unknown>;
}

function setMetaTag(selector: string, attr: 'name' | 'property', key: string, content: string) {
  let el = document.head.querySelector(selector) as HTMLMetaElement | null;
  if (!el) {
    el = document.createElement('meta');
    el.setAttribute(attr, key);
    document.head.appendChild(el);
  }
  el.setAttribute('content', content);
}

export function applySeoMetadata(meta: RouteSeoMeta) {
  const origin = window.location.origin;
  const canonicalUrl = `${origin}${meta.path}`;

  document.title = meta.title;
  setMetaTag('meta[name="robots"]', 'name', 'robots', meta.robots || 'index, follow');
  setMetaTag('meta[name="description"]', 'name', 'description', meta.description);
  setMetaTag('meta[property="og:title"]', 'property', 'og:title', meta.title);
  setMetaTag('meta[property="og:description"]', 'property', 'og:description', meta.description);
  setMetaTag('meta[property="og:type"]', 'property', 'og:type', meta.ogType || 'website');
  setMetaTag('meta[property="og:url"]', 'property', 'og:url', canonicalUrl);
  setMetaTag('meta[name="twitter:title"]', 'name', 'twitter:title', meta.title);
  setMetaTag('meta[name="twitter:description"]', 'name', 'twitter:description', meta.description);

  let canonical = document.head.querySelector('link[rel="canonical"]') as HTMLLinkElement | null;
  if (!canonical) {
    canonical = document.createElement('link');
    canonical.setAttribute('rel', 'canonical');
    document.head.appendChild(canonical);
  }
  canonical.setAttribute('href', canonicalUrl);

  const jsonLdScript = document.getElementById('dynamic-jsonld');
  if (jsonLdScript) {
    jsonLdScript.textContent = meta.jsonLd ? JSON.stringify(meta.jsonLd) : '{}';
  }
}
