#!/bin/bash

if [ ! $(kompose version) | grep '[0-9]{0,2}\.[0-9]{0,2}\.[0-9]{0,2}\s\(\w+\)' ]
then
  curl -L https://github.com/kubernetes/kompose/releases/download/v1.25.0/kompose-linux-amd64 -o kompose
  chmod +x kompose
  sudo mv ./kompose /usr/local/bin/compose
fi

if [ ! $(kubectl version) ]
then
  curl -LO "https://dl.k8s.io/release/$(curl -L -s https://dl.k8s.io/release/stable.txt)/bin/linux/amd64/kubectl"
  sudo install -o root -g root -m 0755 kubectl /usr/local/bin/kubectl
fi

if [ $(which minikube) ]
then
  echo 'hi minikube installed'
  if [ ! $(minikube status ) | grep 'Running' ]
  then
    minikube start
  fi
fi

kompose convert
for i in *service.yaml; do kubectl apply -f $i; done