'use client';

import { useEffect, useMemo, useState, FormEvent } from 'react';
import { Plus, Pencil, Trash2, Search, X, Eye, EyeOff } from 'lucide-react';
import { useProducts } from '@/lib/cart-context';
import {
  fetchBlogPostsAdmin,
  createBlogPost,
  updateBlogPost,
  deleteBlogPost,
} from '@/lib/blog-api';
import { BlogPostRow } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from '@/components/ui/dialog';
import { toast } from 'sonner';

const slugify = (s: string) =>
  s
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');

// Paragraphs are edited as one big textarea, one paragraph per blank-line
// break -- avoids building a whole array-editing UI for what's really just
// "write the article". Kept in sync with the reverse join when opening the
// edit dialog for an existing post.
const bodyToText = (paragraphs: string[]) => paragraphs.join('\n\n');
const textToBody = (text: string) =>
  text
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean);

export default function BlogPanel() {
  const { categories } = useProducts();
  const [posts, setPosts] = useState<BlogPostRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<BlogPostRow | null>(null);
  const [saving, setSaving] = useState(false);
  const [confirmTarget, setConfirmTarget] = useState<BlogPostRow | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const [title, setTitle] = useState('');
  const [slug, setSlug] = useState('');
  const [excerpt, setExcerpt] = useState('');
  const [keywords, setKeywords] = useState('');
  const [coverImage, setCoverImage] = useState('');
  const [bodyText, setBodyText] = useState('');
  const [readMinutes, setReadMinutes] = useState(5);
  const [relatedCategory, setRelatedCategory] = useState<string>('none');
  const [published, setPublished] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      setPosts(await fetchBlogPostsAdmin());
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to load blog posts');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const filteredPosts = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return posts;
    return posts.filter(
      (p) => p.title.toLowerCase().includes(q) || p.slug.toLowerCase().includes(q)
    );
  }, [posts, searchQuery]);

  const openNew = () => {
    setEditing(null);
    setTitle('');
    setSlug('');
    setExcerpt('');
    setKeywords('');
    setCoverImage('');
    setBodyText('');
    setReadMinutes(5);
    setRelatedCategory('none');
    setPublished(true);
    setOpen(true);
  };

  const openEdit = (p: BlogPostRow) => {
    setEditing(p);
    setTitle(p.title);
    setSlug(p.slug);
    setExcerpt(p.excerpt);
    setKeywords(p.keywords.join(', '));
    setCoverImage(p.cover_image);
    setBodyText(bodyToText(p.body_paragraphs));
    setReadMinutes(p.read_minutes);
    setRelatedCategory(p.related_category_name || 'none');
    setPublished(p.published);
    setOpen(true);
  };

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      toast.error('Title is required');
      return;
    }
    const paragraphs = textToBody(bodyText);
    if (paragraphs.length === 0) {
      toast.error('Post body cannot be empty');
      return;
    }
    setSaving(true);
    try {
      const payload = {
        title: title.trim(),
        slug: slug.trim() || slugify(title),
        excerpt: excerpt.trim(),
        keywords: keywords
          .split(',')
          .map((k) => k.trim())
          .filter(Boolean),
        cover_image: coverImage.trim(),
        body_paragraphs: paragraphs,
        read_minutes: readMinutes,
        related_category_name: relatedCategory === 'none' ? null : relatedCategory,
        published,
      };
      if (editing) {
        await updateBlogPost(editing.id, payload);
        toast.success('Post updated');
      } else {
        await createBlogPost({ ...payload, published_at: new Date().toISOString() });
        toast.success('Post added');
      }
      setOpen(false);
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const togglePublished = async (p: BlogPostRow) => {
    try {
      await updateBlogPost(p.id, { published: !p.published });
      toast.success(p.published ? 'Post unpublished' : 'Post published');
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to update');
    }
  };

  const confirmDelete = async () => {
    if (!confirmTarget) return;
    try {
      await deleteBlogPost(confirmTarget.id);
      toast.success('Post deleted');
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Delete failed');
    } finally {
      setConfirmTarget(null);
    }
  };

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-secondary">Admin</p>
          <h1 className="mt-1 font-serif text-3xl font-bold text-primary sm:text-4xl">Blog</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {loading
              ? 'Loading…'
              : searchQuery
              ? `${filteredPosts.length} of ${posts.length} post${posts.length === 1 ? '' : 's'}`
              : `${posts.length} post${posts.length === 1 ? '' : 's'}`}
          </p>
        </div>
        <Button onClick={openNew} className="bg-primary">
          <Plus className="mr-1 h-4 w-4" /> Add Post
        </Button>
      </div>

      <div className="mb-4 relative w-full sm:max-w-xs">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search title, slug…"
          className="pl-9 pr-8"
        />
        {searchQuery && (
          <button
            type="button"
            onClick={() => setSearchQuery('')}
            aria-label="Clear search"
            className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      <div className="overflow-hidden rounded-lg border border-border/60 bg-card">
        <table className="w-full table-auto">
          <thead className="bg-muted/40 text-left text-xs uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="px-4 py-3">Title</th>
              <th className="px-4 py-3">Slug</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Published</th>
              <th className="px-4 py-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredPosts.map((p) => (
              <tr key={p.id} className="border-t">
                <td className="px-4 py-3 text-sm font-medium">{p.title}</td>
                <td className="px-4 py-3 text-sm text-muted-foreground">{p.slug}</td>
                <td className="px-4 py-3 text-sm">
                  <button
                    type="button"
                    onClick={() => togglePublished(p)}
                    className={
                      p.published
                        ? 'inline-flex items-center gap-1 rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700'
                        : 'inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground'
                    }
                  >
                    {p.published ? (
                      <>
                        <Eye className="h-3 w-3" /> Live
                      </>
                    ) : (
                      <>
                        <EyeOff className="h-3 w-3" /> Draft
                      </>
                    )}
                  </button>
                </td>
                <td className="px-4 py-3 text-sm text-muted-foreground">
                  {new Date(p.published_at).toLocaleDateString('en-IN')}
                </td>
                <td className="px-4 py-3 text-sm">
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" onClick={() => openEdit(p)}>
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-destructive hover:bg-destructive/10"
                      onClick={() => setConfirmTarget(p)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
            {!loading && posts.length > 0 && filteredPosts.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-sm text-muted-foreground">
                  No posts match your search.
                </td>
              </tr>
            )}
            {!loading && posts.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-sm text-muted-foreground">
                  No blog posts yet. Add one to get started.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-serif text-xl text-primary">
              {editing ? 'Edit Post' : 'Add Post'}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={onSubmit} className="grid gap-4">
            <div className="grid gap-1.5">
              <Label htmlFor="post-title">Title *</Label>
              <Input
                id="post-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. How to Wear a Banarasi Saree"
                required
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="post-slug">Slug (optional — auto-generated if left blank)</Label>
              <Input
                id="post-slug"
                value={slug}
                onChange={(e) => setSlug(e.target.value)}
                placeholder={slugify(title) || 'how-to-wear-a-banarasi-saree'}
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="post-excerpt">Excerpt (used as meta description, ~160 chars)</Label>
              <Textarea
                id="post-excerpt"
                rows={2}
                value={excerpt}
                onChange={(e) => setExcerpt(e.target.value)}
                placeholder="Short summary shown on the blog listing and in Google search results"
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="post-cover">Cover image URL</Label>
              <Input
                id="post-cover"
                value={coverImage}
                onChange={(e) => setCoverImage(e.target.value)}
                placeholder="https://…"
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="post-body">
                Body — separate paragraphs with a blank line
              </Label>
              <Textarea
                id="post-body"
                rows={10}
                value={bodyText}
                onChange={(e) => setBodyText(e.target.value)}
                placeholder={'First paragraph…\n\nSecond paragraph…'}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-1.5">
                <Label htmlFor="post-read-minutes">Read time (minutes)</Label>
                <Input
                  id="post-read-minutes"
                  type="number"
                  min={1}
                  value={readMinutes}
                  onChange={(e) => setReadMinutes(Number(e.target.value) || 1)}
                />
              </div>
              <div className="grid gap-1.5">
                <Label>Related category (shows a "Shop this" button)</Label>
                <Select value={relatedCategory} onValueChange={setRelatedCategory}>
                  <SelectTrigger>
                    <SelectValue placeholder="None" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    {categories.map((c) => (
                      <SelectItem key={c.id} value={c.name}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="post-keywords">Keywords (comma-separated, for SEO meta tags)</Label>
              <Input
                id="post-keywords"
                value={keywords}
                onChange={(e) => setKeywords(e.target.value)}
                placeholder="banarasi saree kaise pehnein, how to wear banarasi saree"
              />
            </div>
            <div className="flex items-center gap-2">
              <Switch id="post-published" checked={published} onCheckedChange={setPublished} />
              <Label htmlFor="post-published">
                {published ? 'Published (visible on the site)' : 'Draft (hidden from the site)'}
              </Label>
            </div>
            <DialogFooter className="mt-2">
              <DialogClose asChild>
                <Button type="button" variant="outline">
                  Cancel
                </Button>
              </DialogClose>
              <Button type="submit" disabled={saving} className="bg-primary">
                {saving ? 'Saving…' : editing ? 'Save Changes' : 'Add Post'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={!!confirmTarget} onOpenChange={(o) => !o && setConfirmTarget(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-serif text-xl text-primary">Delete this post?</DialogTitle>
            <DialogDescription>
              This will permanently remove &quot;{confirmTarget?.title}&quot; from the blog. This
              action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">Cancel</Button>
            </DialogClose>
            <Button
              onClick={confirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
