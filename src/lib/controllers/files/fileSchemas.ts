import * as v from 'valibot';

// Schemas
export const fileDataSchema = v.object({
	name: v.pipe(
		v.string('File name must be a string.'),
		v.nonEmpty('File name is required.')
	),
	type: v.pipe(
		v.string('File type must be a string.'),
		v.nonEmpty('File type is required.')
	),
	data: v.pipe(
		v.string('File data must be a base64 encoded string.'),
		v.nonEmpty('File data is required.')
	)
});

export const uploadFileResultSchema = v.object({
	key: v.string('Key must be a string.'),
	url: v.string('URL must be a string.'),
	size: v.number('Size must be a number.'),
	contentType: v.string('Content type must be a string.')
});

export const fileInfoSchema = v.object({
	key: v.string('Key must be a string.'),
	size: v.number('Size must be a number.'),
	lastModified: v.date('Last modified must be a date.'),
	etag: v.string('ETag must be a string.')
});

export const deleteFileResultSchema = v.object({
	success: v.boolean('Success must be a boolean.')
});

export const downloadUrlResultSchema = v.object({
	url: v.string('URL must be a string.')
});

// Exported interfaces from schemas
export type FileData = v.InferInput<typeof fileDataSchema>;
export type UploadFileResult = v.InferOutput<typeof uploadFileResultSchema>;
export type FileInfo = v.InferOutput<typeof fileInfoSchema>;
export type DeleteFileResult = v.InferOutput<typeof deleteFileResultSchema>;
export type DownloadUrlResult = v.InferOutput<typeof downloadUrlResultSchema>;

export const keySchema = v.pipe(
	v.string('Key must be a string.'),
	v.nonEmpty('Key is required.')
);

export const prefixSchema = v.optional(v.string('Prefix must be a string.'));

export const pathSchema = v.optional(v.string('Path must be a string.'));