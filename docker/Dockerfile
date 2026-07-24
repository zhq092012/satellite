# 基础镜像
FROM nginx:1.28.0

# 设置环境变量
ENV RUN_USER=nginx
ENV RUN_GROUP=nginx
ENV DATA_DIR=/var/www/html/dist
ENV LOG_DIR=/etc/log/nginx

# 复制文件到指定目录
RUN mkdir -p /var/www/html \
    && mkdir -p /etc/log/nginx \
    && chown nginx:nginx -R /var/www/html \
    && chown nginx:nginx -R /etc/log/nginx 

# default.conf 和 dist 都在当前 docker 构建上下文中
COPY ["default.conf", "/etc/nginx/conf.d/default.conf"]
COPY ["dist", "/var/www/html/dist"]

# 暴露服务端口
EXPOSE 80

# 启动服务
ENTRYPOINT ["nginx", "-g", "daemon off;"]
