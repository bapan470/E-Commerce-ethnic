'use client';

import { supabase } from './supabase';
import { BlogPostRow } from './types';

/** Admin panel needs every post (published + draft); public pages filter
 *  to `published = true` separately (see lib/blog-api-server.ts). */
export async function fetchBlogPostsAdmin(): Promise<BlogPostRow[]> {
  const { data, error } = await supabase
    .from('blog_posts')
    .select('*')
    .order('published_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as BlogPostRow[];
}

export async function createBlogPost(input: {
  slug: string;
  title: string;
  excerpt: string;
  keywords: string[];
  cover_image: string;
  body_paragraphs: string[];
  read_minutes: number;
  related_category_name: string | null;
  published: boolean;
  published_at: string;
}): Promise<BlogPostRow> {
  const { data, error } = await supabase
    .from('blog_posts')
    .insert(input)
    .select('*')
    .single();
  if (error) throw error;
  return data as BlogPostRow;
}

export async function updateBlogPost(
  id: string,
  input: Partial<{
    slug: string;
    title: string;
    excerpt: string;
    keywords: string[];
    cover_image: string;
    body_paragraphs: string[];
    read_minutes: number;
    related_category_name: string | null;
    published: boolean;
    published_at: string;
  }>
): Promise<BlogPostRow> {
  const { data, error } = await supabase
    .from('blog_posts')
    .update({ ...input, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select('*')
    .single();
  if (error) throw error;
  return data as BlogPostRow;
}

export async function deleteBlogPost(id: string): Promise<void> {
  const { error } = await supabase.from('blog_posts').delete().eq('id', id);
  if (error) throw error;
}
