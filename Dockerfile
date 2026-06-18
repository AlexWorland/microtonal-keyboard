# Static host for the microtonal piano keyboard web app.
# The app is plain HTML/CSS/ES-module JS — it only needs to be served over HTTP
# (ES module imports don't load from file://). nginx:alpine is a tiny, robust fit.
FROM nginx:1.27-alpine

# Replace the default server block with ours (gzip, caching, /healthz).
COPY docker/nginx.conf /etc/nginx/conf.d/default.conf

# Ship only the web app — not Electron, tests, docs, or node_modules.
COPY index.html styles.css /usr/share/nginx/html/
COPY src/ /usr/share/nginx/html/src/

EXPOSE 80

# Container-level healthcheck (compose also defines one).
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget -qO- http://localhost/healthz || exit 1
