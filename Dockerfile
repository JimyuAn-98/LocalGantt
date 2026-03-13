# Use the official slim Python image
FROM python:3.11-slim

# set a working directory
WORKDIR /app

# install dependencies first (cached layers)
COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

# copy the rest of the source
COPY . .

# expose the port the app listens on
EXPOSE 1258

# environment variables for flask
ENV FLASK_APP=app.py
ENV FLASK_RUN_HOST=0.0.0.0
ENV FLASK_RUN_PORT=1258

# default command
CMD ["python", "app.py"]
