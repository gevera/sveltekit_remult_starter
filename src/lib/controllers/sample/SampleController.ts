import { BackendMethod, Fields } from 'remult';
import { Accepts, Returns } from '$lib/utils/openApi';
import { validateSchema } from '$lib/utils';

export class InputNumbersSchema {
	@Fields.number({
		required: true
	})
	a = 0;
	@Fields.number({
		required: true
	})
	b = 0;
}

export class SampleController {
	@BackendMethod({ allowed: true })
	@Returns({ type: 'string' })
	static async getSample() {
		return 'Hello, world!';
	}
	@BackendMethod({ allowed: true })
	@Returns({ type: 'number' })
	@Accepts({ schema: InputNumbersSchema })
	static async addNumbers({a,b}: {a: number, b: number}) {
		const validatedData = await validateSchema(InputNumbersSchema, { a, b });
		const result = validatedData.a + validatedData.b;
		return result;
	}
}
