# Emotion Recognition using CNN

This project trains a Convolutional Neural Network (CNN) for emotion recognition using physiological signal data. It includes modules for data loading, model training, and real-time emotion prediction from live input data.

## Overview

The project is divided into four main Python scripts:

- **`CNN.py`** — Defines the CNN architecture used for emotion classification.
- **`DataLoader.py`** — Handles data preprocessing and loading for training and evaluation.
- **`Train.py`** — Trains the CNN model on labeled data and saves the trained weights.
- **`Run.py`** — Loads the trained model and runs it on live or incoming data for emotion prediction from the database server.

## Requirements

Install the required dependencies before running the project:

`pip install torch torchvision torchaudio numpy scipy scikit-learn imbalanced-learn`

## How to use

This model uses the DEAP dataset to train on. Once you have access to the files, place them in a folder named "data", and place the participant to be left out in a folder named "leaveOneOut".
Then run the script using `python Train.py`.

To run the model with live watch data, researcher database access is required from the Auckland Bioengineering Institute. Once obtained, replace the id, username, and password in the Run.py file. Then run using `python Run.py`.
