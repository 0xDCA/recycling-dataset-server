from flask import Flask, send_from_directory, request
from flask_socketio import SocketIO, emit, send, join_room
import uuid
import sqlite3
import base64
import os.path

DASHBOARDS_ROOM = 'dashboards'
DEVICES_ROOM = 'devices'
DATABASE_FILE_NAME = 'dataset/dataset.db'
DATASET_IMAGES_PATH = 'dataset/images/'

app = Flask(__name__)
app.config['SECRET_KEY'] = 'super_secret'
socketio = SocketIO(app)

devices = {}

def set_up_database():
    with sqlite3.connect(DATABASE_FILE_NAME) as connection:
        connection.execute(
            """CREATE TABLE IF NOT EXISTS samples (filename TEXT,
                product TEXT, classification TEXT, comments TEXT, source_device TEXT)"""
        )

        connection.commit()

@socketio.on('get-devices')
def on_get_devices(_):
    print("on_get_devices")

    result = [{
        "client_id": device,
        "name": devices[device]
    } for device in devices]

    return result

@socketio.on('register-device')
def on_register_device(data):
    client_id, client_name = request.sid, data['client_name']
    print("Associating device \"%s\" to name \"%s\"" % (client_id, client_name))

    devices[client_id] = client_name

    join_room(DEVICES_ROOM)

    socketio.emit('device-registered', {
        "client_id": client_id,
        "name": client_name
    }, room=DASHBOARDS_ROOM)


@socketio.on('register-dashboard')
def on_register_dashboard(_):
    client_id = request.sid
    print("Associating dashboard \"%s\"" % (client_id, ))

    join_room(DASHBOARDS_ROOM)


@socketio.on('disconnect')
def on_client_disconnect():
    client_id = request.sid

    if client_id in devices:
        client_name = devices[client_id]

        del devices[client_id]

        socketio.emit('device-disconnected', {
            "client_id": client_id,
            "name": client_name
        }, room=DASHBOARDS_ROOM)

@socketio.on('request-picture')
def on_request_picture(data):
    request_id = data.get('request_id', None)
    if request_id is None:
         request_id = str(uuid.uuid4())

    room = data.get('client_id', None)
    if room is None:
        room = DEVICES_ROOM

    socketio.emit('picture-requested', {
        "request_id": request_id
    }, room=room)

    return request_id

@socketio.on('picture-available')
def on_picture_available(data):
    """
    data: {
        request_id: string,
        image: binary
    }
    """

    new_data = {
        "request_id": data['request_id'],
        "image": data['image'],
        "client_id": request.sid
    }
    socketio.emit('picture-available', new_data, room=DASHBOARDS_ROOM, json=True)

@socketio.on('add-images')
def on_add_images(data):
    """
    data: {
        "images": {
            client_id: binary
        },
        "product": string,
        "classification": "BLUE" | "GREEN" | "GRAY",
        "comments": string
    }
    """

    with sqlite3.connect(DATABASE_FILE_NAME) as connection:
        for client_id, image in data['images'].items():
            file_name = "%s.jpg" % (uuid.uuid4(),)
            file_path = os.path.join(DATASET_IMAGES_PATH, file_name)

            with open(file_path, 'wb') as f:
                f.write(image)

            assert client_id in devices
            source_device = devices[client_id]

            connection.execute("""INSERT INTO samples (filename,
                product, classification, comments, source_device) VALUES (?, ?, ?, ?, ?)""",
                (file_name,  data['product'], data['classification'], data['comments'], source_device))

        connection.commit()


@app.route('/')
def index():
    return send_from_directory('static', 'index.html')

@app.route('/sample-device')
def sample_device():
    return send_from_directory('static', 'sample-device.html')

@app.route('/static/<path:filename>')
def serve_static_file(filename):
    return send_from_directory('static', filename)

if __name__ == '__main__':
    set_up_database()
    socketio.run(app)
