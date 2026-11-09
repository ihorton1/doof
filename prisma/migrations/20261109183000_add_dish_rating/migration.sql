CREATE TYPE "DishRating" AS ENUM ('dud', 'eh', 'yum', 'delish');

ALTER TABLE "Dish" ADD COLUMN "rating" "DishRating";
