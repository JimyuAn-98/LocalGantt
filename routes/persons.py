from flask import Blueprint, request, jsonify
from models import db, Person

persons_bp = Blueprint('persons', __name__)

@persons_bp.route('/', methods=['GET'])
def get_persons():
    persons = Person.query.all()
    return jsonify([person.to_dict() for person in persons])

@persons_bp.route('/<int:person_id>', methods=['GET'])
def get_person(person_id):
    person = Person.query.get_or_404(person_id)
    return jsonify(person.to_dict())

@persons_bp.route('/', methods=['POST'])
def create_person():
    data = request.get_json()
    if not data or 'name' not in data:
        return jsonify({'error': 'Missing required field: name'}), 400
    
    existing = Person.query.filter_by(name=data['name']).first()
    if existing:
        return jsonify({'error': 'Person with this name already exists'}), 400
    
    person = Person(
        name=data['name'],
        color=data.get('color', '#3498db')
    )
    db.session.add(person)
    db.session.commit()
    return jsonify(person.to_dict()), 201

@persons_bp.route('/<int:person_id>', methods=['PUT'])
def update_person(person_id):
    person = Person.query.get_or_404(person_id)
    data = request.get_json()
    
    if 'name' in data:
        existing = Person.query.filter(Person.name == data['name'], Person.id != person_id).first()
        if existing:
            return jsonify({'error': 'Person with this name already exists'}), 400
        person.name = data['name']
    if 'color' in data:
        person.color = data['color']
    
    db.session.commit()
    return jsonify(person.to_dict())

@persons_bp.route('/<int:person_id>', methods=['DELETE'])
def delete_person(person_id):
    person = Person.query.get_or_404(person_id)
    db.session.delete(person)
    db.session.commit()
    return jsonify({'message': 'Person deleted'}), 200
