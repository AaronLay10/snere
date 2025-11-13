#!/bin/bash
echo "Docker System Health Check"
echo "========================="
echo ""
echo "Docker Version:"
docker --version
echo ""
echo "Docker Compose Version:"
docker compose version
echo ""
echo "Running Containers:"
docker ps
echo ""
echo "Docker Networks:"
docker network ls
echo ""
echo "Docker Volumes:"
docker volume ls
echo ""
echo "System Resources:"
docker system df
echo ""
echo "Memory Usage:"
free -h
echo ""
echo "Disk Usage:"
df -h /opt/sentient /opt/sentient-dev
