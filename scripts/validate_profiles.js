import fs from 'fs';
import path from 'path';

import Ajv from 'ajv';

const schemaPath = path.join(process.cwd(), 'scripts', 'LLM_profiles.schema.json');
const profilesPath = path.join(process.cwd(), 'packages', 'cli', 'src', 'config', 'LLM_profiles.json');

const schema = JSON.parse(fs.readFileSync(schemaPath, 'utf-8'));
const profiles = JSON.parse(fs.readFileSync(profilesPath, 'utf-8'));

const ajv = new Ajv({ allErrors: true, allowUnionTypes: true });
const validate = ajv.compile(schema);
const valid = validate(profiles);

if (!valid) {
  console.error('LLM_profiles.json validation failed:');
  console.error(validate.errors);
  process.exit(2);
}

console.log('LLM_profiles.json is valid');
process.exit(0);
