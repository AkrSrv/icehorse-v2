import json
import os
import database
import models

def seed_drf_classes():
    models.Base.metadata.create_all(bind=database.engine)
    db = database.SessionLocal()
    
    json_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'drf_dressage_templates.json')
    if not os.path.exists(json_path):
        print(f'Templates file {json_path} not found!')
        return
        
    with open(json_path, 'r', encoding='utf-8') as f:
        templates = json.load(f)
        
    print(f'Seeding {len(templates)} DRF Dressage classes into database...')
    
    added = 0
    updated = 0
    
    for tpl in templates:
        code = tpl['code']
        name = tpl['name']
        config_str = json.dumps(tpl['configuration'])
        
        # Check if already exists by code and discipline
        existing = db.query(models.ClassDefinition).filter(
            models.ClassDefinition.discipline == 'dressage',
            models.ClassDefinition.name == name
        ).first()
        
        if existing:
            existing.code = code
            existing.scoring_model = 'dressage_percentage'
            existing.configuration = config_str
            updated += 1
        else:
            new_cls = models.ClassDefinition(
                discipline='dressage',
                code=code,
                name=name,
                scoring_model='dressage_percentage',
                configuration=config_str
            )
            db.add(new_cls)
            added += 1
            
    db.commit()
    db.close()
    print(f'Done! Added: {added}, Updated: {updated} DRF dressage class definitions.')

if __name__ == '__main__':
    seed_drf_classes()
