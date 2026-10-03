# Il frontend dentro un container, in due fasi.
#
# Fase 1: si compila l'applicazione Angular (qui servono Node e le librerie di sviluppo).
# Fase 2: i file compilati vengono copiati dentro nginx, che li serve e fa da proxy
#         verso l'API. L'immagine finale non contiene Node ne' i sorgenti: solo
#         gli html, i css e i javascript gia' ottimizzati.

FROM node:24-alpine AS compilazione

WORKDIR /app

# Prima le sole dipendenze: se il codice cambia ma il package.json no, Docker
# riusa questo strato e non reinstalla tutto da capo.
COPY package.json package-lock.json ./

RUN npm ci

COPY . .

RUN npm run build

FROM nginx:alpine

COPY --from=compilazione /app/dist/esame_angular/browser /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
