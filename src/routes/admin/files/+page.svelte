<script lang="ts">
	import { enhance } from '$app/forms';
	import type { FileInfo } from '$lib/controllers/files/fileSchemas';

    let { data } = $props();
    $effect(() => {
        console.log(data);
    });

	let files = $derived(data.files);
	let loading = $state(false);

	function isImage(key: string): boolean {
		const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg', '.bmp', '.ico'];
		return imageExtensions.some(ext => key.toLowerCase().endsWith(ext));
	}
</script>

<h1>Files</h1>

{#if data.form?.error}
	<div>
		<p>Error: {data.form.error}</p>
	</div>
{/if}

{#if data.form?.success}
	<div>
		<p>Success!</p>
	</div>
{/if}

<div>
	<h2>Upload File</h2>
	<form action='?/upload' method="POST" enctype="multipart/form-data" use:enhance>
		<input type="file" name="file" required disabled={loading} />
		<button type="submit" disabled={loading}>Upload</button>
		{#if loading}
			<p>Loading...</p>
		{/if}
	</form>
</div>

<div>
	<h2>Files</h2>
	{#if loading && files.length === 0}
		<p>Loading files...</p>
	{:else if files.length === 0}
		<p>No files found</p>
	{:else}
		<ul>
			{#each files as file}
				<li>
					<div>
						{#if isImage(file.key)}
							<div>
								<img src="/api/images/{file.key}" alt={file.key} style="max-width: 300px; max-height: 300px; object-fit: contain;" />
							</div>
						{/if}
						<p>Name: {file.key}</p>
						<p>Size: {file.size} bytes</p>
						<p>Last Modified: {new Date(file.lastModified).toLocaleString()}</p>
						<a href="/api/images/{file.key}" target="_blank">View</a>
                        <form action='?/delete' method="POST" use:enhance>
                            <input type="hidden" name="key" value={file.key} />
                            <button type="submit" disabled={loading}>Delete</button>
                        </form>
					</div>
				</li>
			{/each}
		</ul>
	{/if}
</div>
