import type { Persona, PersonaId } from '../../contracts';
import { shenxu } from './shenxu';
import { jiangye } from './jiangye';
import { linche } from './linche';

export const personas: Record<PersonaId, Persona> = { shenxu, jiangye, linche };

export function getPersona(personaId: PersonaId): Persona {
  return personas[personaId];
}
