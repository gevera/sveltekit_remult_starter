import { Roles_Auth } from './authEntities';

/** ALL ROLES of your application. [Learn more](https://remult.dev/docs/modules#roles) */
export const Roles = {
	Admin: 'admin',
	Manager: 'manager',
	Employee: 'employee',
	...Roles_Auth
} as const;
