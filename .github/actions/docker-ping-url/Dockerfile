FROM python:alpine3.19

WORKDIR /apps

COPY requirements.txt .

RUN python -V
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

CMD ["python", "/apps/main.py"]