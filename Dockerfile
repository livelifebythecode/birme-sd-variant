FROM nginx:1.24.0-alpine

COPY --chmod=0777 . /usr/share/nginx/html/

CMD ["nginx", "-g", "daemon off;"]