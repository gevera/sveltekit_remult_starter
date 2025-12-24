import { Entity, Fields } from 'remult';

@Entity('planets', {
	allowApiCrud: true
})
export class Planet {
	@Fields.id()
	id!: string;

	@Fields.string()
	title: string = '';

	@Fields.boolean()
	isGiant: boolean = false;

	@Fields.date()
	discoveryDate?: Date;

	@Fields.number()
	mass!: number;

	@Fields.number()
	radius!: number;

	@Fields.number()
	numberOfSatelites: number = 0;

	@Fields.createdAt()
	createdAt?: Date;
}
