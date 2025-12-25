import { randomUUID } from 'crypto';
import { BackendMethod } from 'remult';
import * as v from 'valibot';
import { deleteFileResultSchema, downloadUrlResultSchema, fileDataSchema, fileInfoSchema, keySchema, pathSchema, prefixSchema, uploadFileResultSchema, type DeleteFileResult, type DownloadUrlResult, type FileInfo, type UploadFileResult } from './fileSchemas';
import { s3Client } from './s3Client';

/**
 * Controller for managing file operations with S3 storage.
 * Provides methods for uploading, deleting, listing, and retrieving download URLs for files.
 */
export class FilesController {
	/**
	 * Uploads a file to S3 storage.
	 * 
	 * @param fileData - File data object containing:
	 *   - name: The original file name (string, required)
	 *   - type: The MIME type of the file (string, required)
	 *   - data: Base64 encoded file content (string, required)
	 * @param path - Optional path prefix for organizing files in S3 (string, optional)
	 * @returns Promise resolving to an object containing:
	 *   - key: The S3 key/path where the file was stored
	 *   - url: The API URL to access the uploaded file
	 *   - size: The size of the uploaded file in bytes
	 *   - contentType: The MIME type of the uploaded file
	 */
	@BackendMethod({ allowed: true })
	static async uploadFile(
		fileData: unknown,
		path?: string
	): Promise<UploadFileResult> {
		// Validate fileData
		const validatedFileData = v.parse(fileDataSchema, fileData);

		// Validate path if provided
		if (path !== undefined) {
			v.parse(pathSchema, path);
		}

		const fileExtension = validatedFileData.name.split('.').pop() || '';
		const uniqueId = randomUUID();
		const fileName = `${uniqueId}.${fileExtension}`;
		const key = path ? `${path}/${fileName}` : fileName;

		// Decode base64 string to buffer
		// Remove data URL prefix if present (e.g., "data:image/png;base64,")
		const base64Data = validatedFileData.data.includes(',')
			? validatedFileData.data.split(',')[1]
			: validatedFileData.data;

		const buffer = Buffer.from(base64Data, 'base64');

		await s3Client.putObject(key, buffer, validatedFileData.type);

		const result: UploadFileResult = {
			key,
			url: `/api/images/${key}`,
			size: buffer.length,
			contentType: validatedFileData.type
		};

		// Validate result before returning
		return v.parse(uploadFileResultSchema, result);
	}

	/**
	 * Deletes a file from S3 storage.
	 * 
	 * @param key - The S3 key/path of the file to delete (string, required)
	 * @returns Promise resolving to an object containing:
	 *   - success: Boolean indicating whether the file was successfully deleted
	 */
	@BackendMethod({ allowed: true })
	static async deleteFile(key: unknown): Promise<DeleteFileResult> {
		// Validate key
		const validatedKey = v.parse(keySchema, key);

		const deleted = await s3Client.deleteObject(validatedKey);

		const result: DeleteFileResult = {
			success: deleted
		};

		// Validate result before returning
		return v.parse(deleteFileResultSchema, result);
	}

	/**
	 * Lists files in S3 storage, optionally filtered by a prefix.
	 * 
	 * @param prefix - Optional prefix to filter files by path (string, optional)
	 * @returns Promise resolving to an array of file information objects, each containing:
	 *   - key: The S3 key/path of the file
	 *   - size: The size of the file in bytes
	 *   - lastModified: The date when the file was last modified
	 *   - etag: The ETag of the file
	 */
	@BackendMethod({ allowed: true })
	static async listFiles(prefix?: string): Promise<FileInfo[]> {
		// Validate prefix if provided
		const validatedPrefix = prefix !== undefined ? v.parse(prefixSchema, prefix) : undefined;

		const objects = await s3Client.listObjects('/', validatedPrefix || '');

		if (!objects) {
			return [];
		}

		const fileInfos = objects.map((obj) => ({
			key: obj.Key,
			size: typeof obj.Size === 'string' ? Number.parseInt(obj.Size, 10) : obj.Size,
			lastModified: typeof obj.LastModified === 'string' ? new Date(obj.LastModified) : obj.LastModified,
			etag: obj.ETag
		}));

		// Validate each file info
		return fileInfos.map((info) => v.parse(fileInfoSchema, info));
	}

	/**
	 * Gets the download URL for a file stored in S3.
	 * 
	 * @param key - The S3 key/path of the file (string, required)
	 * @returns Promise resolving to an object containing:
	 *   - url: The API URL to download/access the file
	 */
	@BackendMethod({ allowed: true })
	static async getDownloadUrl(key: unknown): Promise<DownloadUrlResult> {
		// Validate key
		const validatedKey = v.parse(keySchema, key);

		// For public buckets, we can return the direct URL
		// For now, return the API route URL
		const result: DownloadUrlResult = {
			url: `/api/images/${validatedKey}`
		};

		// Validate result before returning
		return v.parse(downloadUrlResultSchema, result);
	}
}

