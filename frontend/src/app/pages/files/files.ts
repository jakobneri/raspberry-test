import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Sidebar } from '../../components/sidebar/sidebar';
import { ApiService, FileItem } from '../../services/api';

@Component({
  selector: 'app-files',
  imports: [CommonModule, Sidebar],
  templateUrl: './files.html',
  styleUrl: './files.scss',
})
export class Files implements OnInit {
  files: FileItem[] = [];
  loading = true;
  uploading = false;
  dragOver = false;

  constructor(private api: ApiService) {}

  ngOnInit(): void {
    this.fetchFiles();
  }

  fetchFiles(): void {
    this.api.getFiles().subscribe({
      next: (files) => {
        this.files = files;
        this.loading = false;
      },
      error: (err) => {
        console.error('Error fetching files:', err);
        this.loading = false;
      },
    });
  }

  onFileSelect(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files?.length) {
      this.uploadFile(input.files[0]);
    }
  }

  onDragOver(event: DragEvent): void {
    event.preventDefault();
    this.dragOver = true;
  }

  onDragLeave(event: DragEvent): void {
    event.preventDefault();
    this.dragOver = false;
  }

  onDrop(event: DragEvent): void {
    event.preventDefault();
    this.dragOver = false;

    if (event.dataTransfer?.files.length) {
      this.uploadFile(event.dataTransfer.files[0]);
    }
  }

  uploadFile(file: File): void {
    this.uploading = true;
    this.api.uploadFile(file).subscribe({
      next: () => {
        this.uploading = false;
        this.fetchFiles();
      },
      error: (err) => {
        console.error('Error uploading file:', err);
        this.uploading = false;
        alert('Error uploading file');
      },
    });
  }

  downloadFile(filename: string): void {
    window.open(this.api.downloadFile(filename), '_blank');
  }

  deleteFile(filename: string): void {
    if (confirm(`Are you sure you want to delete "${filename}"?`)) {
      this.api.deleteFile(filename).subscribe({
        next: () => this.fetchFiles(),
        error: (err) => {
          console.error('Error deleting file:', err);
          alert('Error deleting file');
        },
      });
    }
  }

  formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  formatDate(date: string): string {
    return new Date(date).toLocaleString('de-DE');
  }

  getFileIcon(filename: string): string {
    const ext = filename.split('.').pop()?.toLowerCase();
    switch (ext) {
      case 'pdf':
        return '📕';
      case 'doc':
      case 'docx':
        return '📘';
      case 'xls':
      case 'xlsx':
        return '📗';
      case 'jpg':
      case 'jpeg':
      case 'png':
      case 'gif':
        return '🖼️';
      case 'mp3':
      case 'wav':
        return '🎵';
      case 'mp4':
      case 'avi':
      case 'mov':
        return '🎬';
      case 'zip':
      case 'rar':
      case '7z':
        return '📦';
      default:
        return '📄';
    }
  }
}
