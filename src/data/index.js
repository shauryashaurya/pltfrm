// The packaged study, assembled at build time from study.json and every file in products/ (layout: see model.js)
import study from './study.json';
import { assembleStudy } from './model.js';

const files = import.meta.glob('./products/*.json', { eager: true, import: 'default' });

export default assembleStudy(study, Object.values(files));
