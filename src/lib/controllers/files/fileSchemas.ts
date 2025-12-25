import { Fields } from 'remult';

// File data schema - for uploading files
export class FileDataSchema {
	@Fields.string({
		required: true
	})
	name = '';

	@Fields.string({
		required: true
	})
	type = '';

	@Fields.string({
		required: true
	})
	data = '';
}

// Upload file result schema
export class UploadFileResultSchema {
	@Fields.string()
	key = '';

	@Fields.string()
	url = '';

	@Fields.number()
	size = 0;

	@Fields.string()
	contentType = '';
}

// File info schema - for listing files
export class FileInfoSchema {
	@Fields.string()
	key = '';

	@Fields.number()
	size = 0;

	@Fields.date()
	lastModified = new Date();

	@Fields.string()
	etag = '';
}

// Delete file result schema
export class DeleteFileResultSchema {
	@Fields.boolean()
	success = false;
}

// Download URL result schema
export class DownloadUrlResultSchema {
	@Fields.string()
	url = '';
}

// Simple validation schemas for parameters
export class KeySchema {
	@Fields.string({
		required: true
	})
	key = '';
}

export class PrefixSchema {
	@Fields.string()
	prefix = '';
}

export class PathSchema {
	@Fields.string()
	path = '';
}

// Exported types from schemas
export type FileData = FileDataSchema;
export type UploadFileResult = UploadFileResultSchema;
export type FileInfo = FileInfoSchema;
export type DeleteFileResult = DeleteFileResultSchema;
export type DownloadUrlResult = DownloadUrlResultSchema;
