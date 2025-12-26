import { BackendMethod } from "remult";

export class SampleController {
	@BackendMethod({ allowed: true })
	static async getSample() {
		return 'Hello, world!';
	}
}