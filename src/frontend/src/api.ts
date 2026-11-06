import axios from 'axios';

const api = axios.create({
    baseURL: 'http://localhost:3000/api',
});

export default {
    getIngredients: () => api.get('/ingredients').then(res => res.data),
    getRecipes: () => api.get('/recipes').then(res => res.data),
    getRecipe: (id: number) => api.get(`/recipes/${id}`).then(res => res.data),
    createRecipe: (data: any) => api.post('/recipes', data).then(res => res.data),
    
    getDiary: (date: string) => api.get(`/diary?date=${date}`).then(res => res.data),
    logDiary: (data: any) => api.post('/diary', data).then(res => res.data),
    updateDiary: (id: number, data: any) => api.put(`/diary/${id}`, data).then(res => res.data),
    deleteDiary: (id: number) => api.delete(`/diary/${id}`).then(res => res.data),
};