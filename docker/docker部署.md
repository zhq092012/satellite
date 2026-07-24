# docker部署

docker login https://192.168.100.13

Username: staff

Password: Letmein123

docker images

docker rm -f a94c3e655b15

docker build -t 192.168.100.13/kgms/satellite-webui:0.0.20 .

docker push 192.168.100.13/kgms/satellite-webui:0.0.20

# 打包

docker save -o satellite-webui.tar satellite-webui:0.0.14
docker save -o nginx.tar nginx:latest

# 流水线

本地win + R

ssh admin@192.168.100.12

xajd@123

# 代理的文件目录

cd /mnt/xajdlab/sentiment/ver-2.1.0/webui/config

替换镜像版本号后vi webui.yaml

cd /mnt/share/manifest/ver-2.1.0

按住A,进编辑,上下移动修后

按下esc 输入:wq 退出了

kubectl delete -f webui.yaml

kubectl apply -f webui.yaml

# 查看镜像

<https://192.168.100.13> admin xajd@123

镜像查看目录 xajdlab/ xajdlab/sentiment-webui

# 重启服务

<http://192.168.100.22/> admin xajd@123

<http://192.168.100.22/kubepi/dashboard/pods?cluster=xjdlab-kube>
