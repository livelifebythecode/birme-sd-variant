FROM nginx:1.24.0

ADD ./ /usr/share/nginx/html/

CMD ["nginx", "-g", "daemon off;"]
