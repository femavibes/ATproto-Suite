FROM node:18-alpine as build

WORKDIR /app
COPY package*.json ./
RUN npm install

COPY . .
RUN npm run build

# Replace BUILD_TIME placeholder with current timestamp
RUN sed -i "s/{{ BUILD_TIME }}/$(date +%s)/g" /app/dist/index.html

FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html
# Copy PWA files
COPY --from=build /app/manifest.json /usr/share/nginx/html/
COPY --from=build /app/sw.js /usr/share/nginx/html/
COPY --from=build /app/icon-*.svg /usr/share/nginx/html/
COPY nginx.conf /etc/nginx/nginx.conf
RUN rm /etc/nginx/conf.d/default.conf

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]